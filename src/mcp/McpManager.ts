import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { ToolResult } from '../types.js';
import type { McpServerConfig } from './config.js';
import { loadMcpConfig } from './config.js';
import { McpTool } from './McpTool.js';

export interface McpServerStatus {
  name: string;
  status: 'connected' | 'disconnected';
  toolCount: number;
}

interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpConnection {
  config: McpServerConfig;
  client: Client;
  tools: McpToolInfo[];
}

/**
 * Manages MCP server connections and exposes their tools to the
 * ToolRegistry. Servers connect on demand via `connect(name)`.
 */
export class McpManager {
  private registry: ToolRegistry;
  private configs = new Map<string, McpServerConfig>();
  private connections = new Map<string, McpConnection>();

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  async loadConfig(projectRoot: string): Promise<void> {
    this.configs = await loadMcpConfig(projectRoot);
  }

  getConfigNames(): string[] {
    return [...this.configs.keys()];
  }

  /** Return the command+args string for a server (for display before connecting). */
  getServerCommand(name: string): string | undefined {
    const cfg = this.configs.get(name);
    if (!cfg) return undefined;
    const args = cfg.args.length > 0 ? ` ${cfg.args.join(' ')}` : '';
    return `${cfg.command}${args}`;
  }

  getStatus(): McpServerStatus[] {
    return [...this.configs.keys()].map(name => {
      const conn = this.connections.get(name);
      return {
        name,
        status: conn ? 'connected' : 'disconnected',
        toolCount: conn?.tools.length ?? 0,
      };
    });
  }

  async connect(name: string): Promise<string> {
    const config = this.configs.get(name);
    if (!config) return `Unknown MCP server: ${name}`;
    if (this.connections.has(name)) return `Server "${name}" is already connected.`;

    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });
      const client = new Client({ name: 'wardayacode', version: '0.6.1' });
      await client.connect(transport);

      const { tools } = await client.listTools();
      const toolInfos: McpToolInfo[] = tools.map(t => ({
        name: t.name,
        description: t.description ?? '',
        inputSchema: t.inputSchema as Record<string, unknown>,
      }));

      this.connections.set(name, { config, client, tools: toolInfos });

      for (const t of toolInfos) {
        this.registry.register(new McpTool(this, name, t.name, t.description, t.inputSchema));
      }

      return `Connected to ${name} (${toolInfos.length} tools).`;
    } catch (error) {
      this.connections.delete(name);
      return `Failed to connect to ${name}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async disconnect(name: string): Promise<string> {
    const conn = this.connections.get(name);
    if (!conn) return `Server "${name}" is not connected.`;

    for (const t of conn.tools) {
      this.registry.unregister(`mcp__${name}__${t.name}`);
    }

    try {
      await conn.client.close();
    } catch {
      // ignore close errors
    }
    this.connections.delete(name);
    return `Disconnected from ${name}.`;
  }

  async disconnectAll(): Promise<void> {
    for (const name of [...this.connections.keys()]) {
      await this.disconnect(name);
    }
  }

  async callTool(server: string, tool: string, args: Record<string, unknown>): Promise<ToolResult> {
    const conn = this.connections.get(server);
    if (!conn) {
      return { success: false, error: `MCP server "${server}" is not connected.` };
    }
    try {
      const result = await conn.client.callTool({ name: tool, arguments: args });
      const text = extractText(result.content as Array<{ type?: string; text?: string }>);
      if (result.isError) {
        return { success: false, error: text || 'MCP tool returned an error.' };
      }
      return { success: true, content: text || '(no output)' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

function extractText(content: Array<{ type?: string; text?: string }>): string {
  return content
    .filter(c => c.type === 'text' && c.text)
    .map(c => c.text)
    .join('\n');
}
