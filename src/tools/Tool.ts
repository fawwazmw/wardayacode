/**
 * Base Tool class - all tools extend this
 */

import { ToolDefinition, ToolResult, ToolUse } from '../types.js';

export abstract class Tool {
  abstract definition: ToolDefinition;

  /**
   * Execute the tool with given input
   */
  abstract execute(input: Record<string, unknown>): Promise<ToolResult>;

  /**
   * Optional: custom permission logic
   * Override to implement tool-specific permission checks
   */
  async checkPermission?(context: Record<string, unknown>): Promise<boolean> {
    return true;
  }

  /**
   * Validate input against schema
   */
  validateInput(input: Record<string, unknown>): boolean {
    const schema = this.definition.inputSchema;
    if (!schema.required) return true;

    for (const field of schema.required) {
      if (!(field in input)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get tool definition for LLM
   */
  getDefinition(): ToolDefinition {
    return this.definition;
  }
}
