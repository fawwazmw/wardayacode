import { streamText, type LanguageModel, type CoreMessage, type CoreTool } from 'ai';
import { z } from 'zod';
import EventEmitter from 'eventemitter3';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { PermissionSystem } from '../permissions/PermissionSystem.js';
import type { ToolResult } from '../types.js';

export interface AgentConfig {
  model: LanguageModel;
  toolRegistry: ToolRegistry;
  permissions: PermissionSystem;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  maxSteps?: number;
}

export interface AgentEvents {
  'text-delta': (delta: string) => void;
  'tool-call-start': (payload: { toolName: string; args: Record<string, unknown> }) => void;
  'tool-call-result': (payload: { toolName: string; result: ToolResult }) => void;
  'error': (error: Error) => void;
  'done': (payload: { text: string; steps: number }) => void;
}

export class Agent extends EventEmitter<AgentEvents> {
  private readonly model: LanguageModel;
  private readonly toolRegistry: ToolRegistry;
  private readonly permissions: PermissionSystem;
  private readonly systemPrompt: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly maxSteps: number;

  constructor(config: AgentConfig) {
    super();
    this.model = config.model;
    this.toolRegistry = config.toolRegistry;
    this.permissions = config.permissions;
    this.systemPrompt = config.systemPrompt ?? 'You are a helpful coding assistant.';
    this.maxTokens = config.maxTokens ?? 4096;
    this.temperature = config.temperature ?? 0;
    this.maxSteps = config.maxSteps ?? 25;
  }

  private buildTools(): Record<string, CoreTool> {
    const tools: Record<string, CoreTool> = {};
    const definitions = this.toolRegistry.getAvailableTools();

    for (const def of definitions) {
      tools[def.name] = {
        description: def.description,
        parameters: this.jsonSchemaToZod(def.inputSchema),
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool(def.name, args);
        },
      };
    }

    return tools;
  }

  private jsonSchemaToZod(schema: { type: string; properties?: Record<string, unknown>; required?: string[] }): z.ZodType {
    if (!schema.properties) {
      return z.object({});
    }

    const shape: Record<string, z.ZodType> = {};

    for (const [key, prop] of Object.entries(schema.properties)) {
      const propSchema = prop as { type?: string; description?: string; enum?: string[] };
      let field: z.ZodType;

      switch (propSchema.type) {
        case 'string':
          field = propSchema.enum
            ? z.enum(propSchema.enum as [string, ...string[]])
            : z.string();
          break;
        case 'number':
        case 'integer':
          field = z.number();
          break;
        case 'boolean':
          field = z.boolean();
          break;
        case 'array':
          field = z.array(z.unknown());
          break;
        case 'object':
          field = z.record(z.unknown());
          break;
        default:
          field = z.unknown();
      }

      if (propSchema.description) {
        field = field.describe(propSchema.description);
      }

      const isRequired = schema.required?.includes(key) ?? false;
      shape[key] = isRequired ? field : field.optional();
    }

    return z.object(shape);
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const permissionResult = await this.permissions.check({ name, input: args });

    if (!permissionResult.allowed) {
      const deniedResult: ToolResult = {
        success: false,
        error: `Permission denied: ${permissionResult.reason ?? 'No reason provided'}`,
      };
      this.emit('tool-call-result', { toolName: name, result: deniedResult });
      return JSON.stringify(deniedResult);
    }

    this.emit('tool-call-start', { toolName: name, args });

    const result = await this.toolRegistry.execute(name, args);
    this.emit('tool-call-result', { toolName: name, result });

    return JSON.stringify(result);
  }

  async run(messages: CoreMessage[]): Promise<string> {
    const allMessages: CoreMessage[] = [];

    if (this.systemPrompt) {
      allMessages.push({ role: 'system', content: this.systemPrompt });
    }

    allMessages.push(...messages);

    const tools = this.buildTools();
    let fullText = '';
    let stepCount = 0;

    try {
      const result = streamText({
        model: this.model,
        messages: allMessages,
        tools,
        maxSteps: this.maxSteps,
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        onStepFinish: ({ stepType }) => {
          if (stepType === 'tool-result') {
            stepCount++;
          }
        },
      });

      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            fullText += part.textDelta;
            this.emit('text-delta', part.textDelta);
            break;
          case 'tool-call':
            break;
          case 'error':
            this.emit('error', part.error instanceof Error ? part.error : new Error(String(part.error)));
            break;
        }
      }

      this.emit('done', { text: fullText, steps: stepCount });
      return fullText;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }
}
