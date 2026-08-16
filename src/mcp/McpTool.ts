import { Tool } from '../tools/Tool.js';
import type { ToolDefinition, ToolResult } from '../types.js';
import type { McpManager } from './McpManager.js';

/** A Tool that delegates execution to an MCP server via McpManager. */
export class McpTool extends Tool {
  definition: ToolDefinition;

  private manager: McpManager;
  private server: string;
  private toolName: string;

  constructor(
    manager: McpManager,
    server: string,
    toolName: string,
    description: string,
    inputSchema: Record<string, unknown>,
  ) {
    super();
    this.manager = manager;
    this.server = server;
    this.toolName = toolName;
    this.definition = {
      name: `mcp__${server}__${toolName}`,
      description,
      inputSchema: inputSchema as unknown as ToolDefinition['inputSchema'],
      concurrency: 'concurrent',
      requiresPermission: true,
    };
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return this.manager.callTool(this.server, this.toolName, input);
  }
}
