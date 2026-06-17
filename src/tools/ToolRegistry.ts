/**
 * Tool Registry - manages all available tools
 */

import { Tool } from './Tool.js';
import { ToolDefinition, ToolResult, ToolUse } from '../types.js';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  /**
   * Get all available tool definitions (for LLM)
   */
  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.getDefinition());
  }

  /**
   * Execute a tool by name
   */
  async execute(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${name}`,
      };
    }

    try {
      if (!tool['validateInput'](input)) {
        return {
          success: false,
          error: `Invalid input for tool ${name}`,
        };
      }

      return await tool.execute(input);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a specific tool
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }
}
