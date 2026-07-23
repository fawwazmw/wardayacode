import { streamText, type LanguageModel, type CoreMessage, type CoreTool } from 'ai';
import { z } from 'zod';
import EventEmitter from 'eventemitter3';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { PermissionSystem } from '../permissions/PermissionSystem.js';
import type { HookSystem } from '../extensibility/HookSystem.js';
import type { ToolResult } from '../types.js';
import { logger } from '../utils/logger.js';
import { isRetryableError, getRetryDelay, sleep } from '../utils/retry.js';
import { injectCwdReminder } from './cwdReminder.js';

export interface AgentConfig {
  model: LanguageModel;
  toolRegistry: ToolRegistry;
  permissions: PermissionSystem;
  hookSystem?: HookSystem;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  maxSteps?: number;
  maxRetries?: number;
  /**
   * Absolute working directory. When set, a recency reminder pinning this path
   * is appended to the latest user turn — recency bias beats the system-prompt
   * prior, which keeps models from inventing sandbox-style paths.
   */
  cwd?: string;
}

export interface AgentEvents {
  'text-delta': (delta: string) => void;
  'tool-call-start': (payload: { toolName: string; args: Record<string, unknown> }) => void;
  'tool-call-result': (payload: { toolName: string; result: ToolResult }) => void;
  'error': (error: Error) => void;
  'retry': (payload: { attempt: number; maxRetries: number; delayMs: number; error: string }) => void;
  'usage': (payload: { promptTokens: number; completionTokens: number; totalTokens: number }) => void;
  'done': (payload: { text: string; steps: number }) => void;
}

export class Agent extends EventEmitter<AgentEvents> {
  private readonly model: LanguageModel;
  private readonly toolRegistry: ToolRegistry;
  private readonly permissions: PermissionSystem;
  private readonly hookSystem: HookSystem | undefined;
  private readonly systemPrompt: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly maxSteps: number;
  private readonly maxRetries: number;
  private readonly cwd: string | undefined;
  private effort: string;

  constructor(config: AgentConfig) {
    super();
    this.model = config.model;
    this.toolRegistry = config.toolRegistry;
    this.permissions = config.permissions;
    this.hookSystem = config.hookSystem;
    this.systemPrompt = config.systemPrompt ?? 'You are a helpful coding assistant.';
    this.maxTokens = config.maxTokens ?? 4096;
    this.temperature = config.temperature ?? 0;
    this.maxSteps = config.maxSteps ?? 25;
    this.maxRetries = config.maxRetries ?? 3;
    this.cwd = config.cwd;
    this.effort = 'medium';
  }

  /** Set the reasoning effort level (low / medium / high). */
  setEffort(level: string): void {
    if (['low', 'medium', 'high'].includes(level)) {
      this.effort = level;
    }
  }

  /** Get current effort level. */
  getEffort(): string {
    return this.effort;
  }

  /** Emit a hook event and return the modified input if a preToolUse hook changed it. */
  private async emitHook(
    event: 'preToolUse' | 'postToolUse' | 'sessionStart' | 'sessionEnd' | 'stop' | 'notification',
    context: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined> {
    if (!this.hookSystem) return undefined;
    const modified = await this.hookSystem.emitWithResult(event, {
      event,
      ...context,
    });
    return modified?.modifiedInput;
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
      const propSchema = prop as {
        type?: string;
        description?: string;
        enum?: string[];
        minLength?: number;
        maxLength?: number;
        pattern?: string;
        minimum?: number;
        maximum?: number;
      };
      let field: z.ZodType;

      switch (propSchema.type) {
        case 'string': {
          if (propSchema.enum) {
            field = z.enum(propSchema.enum as [string, ...string[]]);
          } else {
            let str = z.string();
            if (propSchema.minLength !== undefined) str = str.min(propSchema.minLength);
            if (propSchema.maxLength !== undefined) str = str.max(propSchema.maxLength);
            if (propSchema.pattern !== undefined) str = str.regex(new RegExp(propSchema.pattern));
            field = str;
          }
          break;
        }
        case 'number':
        case 'integer': {
          let num = z.number();
          if (propSchema.minimum !== undefined) num = num.min(propSchema.minimum);
          if (propSchema.maximum !== undefined) num = num.max(propSchema.maximum);
          if (propSchema.type === 'integer') num = num.int();
          field = num;
          break;
        }
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
    // Pre-tool-use hook — can modify args or block execution
    if (this.hookSystem) {
      const hookResult = await this.emitHook('preToolUse', { toolName: name, toolInput: args });
      if (hookResult?.proceed === false) {
        const deniedResult: ToolResult = {
          success: false,
          error: `Blocked by hook: ${hookResult.reason ?? 'No reason provided'}`,
        };
        logger.warn('tool blocked by hook', { tool: name, reason: hookResult.reason });
        this.emit('tool-call-result', { toolName: name, result: deniedResult });
        return JSON.stringify(deniedResult);
      }
      // Use modified input if the hook changed it
      if (hookResult?.modifiedInput) {
        args = hookResult.modifiedInput as Record<string, unknown>;
      }
    }

    const permissionResult = await this.permissions.check({ name, input: args });

    if (!permissionResult.allowed) {
      const deniedResult: ToolResult = {
        success: false,
        error: `Permission denied: ${permissionResult.reason ?? 'No reason provided'}`,
      };
      logger.warn('tool denied', { tool: name, reason: permissionResult.reason });
      this.emit('tool-call-result', { toolName: name, result: deniedResult });
      return JSON.stringify(deniedResult);
    }

    logger.debug('tool call', { tool: name, args });
    this.emit('tool-call-start', { toolName: name, args });

    const start = Date.now();
    const result = await this.toolRegistry.execute(name, args);
    const durationMs = Date.now() - start;

    logger.debug('tool result', { tool: name, success: result.success, durationMs });
    if (!result.success) {
      logger.warn('tool failed', { tool: name, error: result.error, durationMs });
    }

    this.emit('tool-call-result', { toolName: name, result });

    // Post-tool-use hook
    await this.emitHook('postToolUse', { toolName: name, toolInput: args, toolResult: result });

    return JSON.stringify(result);
  }

  async run(messages: CoreMessage[]): Promise<string> {
    const allMessages: CoreMessage[] = [];

    if (this.systemPrompt) {
      allMessages.push({ role: 'system', content: this.systemPrompt });
    }

    const userMessages = this.cwd ? injectCwdReminder(messages, this.cwd) : messages;
    allMessages.push(...userMessages);

    const tools = this.buildTools();

    logger.debug('agent run started', { messageCount: messages.length, model: String(this.model) });

    // Session start hook
    await this.emitHook('sessionStart', { sessionId: this.cwd });

    let lastError: Error | null = null;

    try {
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        let fullText = '';
        let stepCount = 0;
        let outputEmitted = false;
        let streamError: Error | null = null;

        try {
          const result = streamText({
            model: this.model,
            messages: allMessages,
            tools,
            maxSteps: this.maxSteps,
            maxTokens: this.maxTokens,
            temperature: this.temperature,
            maxRetries: 0,
            // Provider-specific reasoning effort. Silently ignored by providers that don't support it.
            ...(this.effort !== 'medium' ? { reasoningEffort: this.effort as 'low' | 'high' } : {}),
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
                outputEmitted = true;
                this.emit('text-delta', part.textDelta);
                break;
              case 'tool-call':
                outputEmitted = true;
                break;
              case 'error':
                streamError = part.error instanceof Error ? part.error : new Error(String(part.error));
                break;
            }
          }

          if (streamError) {
            throw streamError;
          }

          try {
            const usage = await result.usage;
            this.emit('usage', {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            });
            logger.debug('token usage', { ...usage });
          } catch {
            // usage not available — skip
          }

          logger.debug('agent run done', { steps: stepCount, outputChars: fullText.length, attempt });
          this.emit('done', { text: fullText, steps: stepCount });
          return fullText;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          lastError = err;

          // Don't retry if output was already emitted (would duplicate)
          if (outputEmitted) {
            logger.error('agent run failed (output already emitted)', { error: err.message, attempt });
            this.emit('error', err);
            await this.emitHook('stop', { reason: err.message });
            throw err;
          }

          // Don't retry if error is not retryable
          if (!isRetryableError(err)) {
            logger.error('agent run failed (not retryable)', { error: err.message, attempt });
            this.emit('error', err);
            await this.emitHook('stop', { reason: err.message });
            throw err;
          }

          // Last attempt — give up
          if (attempt === this.maxRetries) {
            logger.error('agent run failed (max retries exceeded)', {
              error: err.message,
              attempts: attempt + 1,
            });
            this.emit('error', err);
            await this.emitHook('stop', { reason: err.message });
            throw err;
          }

          // Retry with backoff
          const delayMs = getRetryDelay(err, attempt);
          logger.warn('agent run retrying', {
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
            delayMs,
            error: err.message,
          });
          this.emit('retry', {
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
            delayMs,
            error: err.message,
          });
          await sleep(delayMs);
        }
      }
    } finally {
      await this.emitHook('sessionEnd', {} as Record<string, unknown>);
    }

    throw lastError ?? new Error('Agent run failed for unknown reason');
  }
}
