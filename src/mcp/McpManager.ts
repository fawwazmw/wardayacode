import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import treeKill from 'tree-kill';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { ToolResult } from '../types.js';
import type { McpServerConfig } from './config.js';
import { loadMcpConfig } from './config.js';
import { McpTool } from './McpTool.js';

/**
 * Env vars that can inject code or hijack library loading when a server
 * process spawns. Blocked before the server is launched so a malicious
 * config cannot set them invisibly behind the approval gate.
 *
 * NOTE: this is defense-in-depth, NOT a security guarantee — a denylist can
 * never enumerate every dangerous variable. The primary security boundary is
 * the connect approval gate (`/mcp connect`), which surfaces the exact
 * command, args, AND full env for explicit user approval before anything is
 * spawned. These prefixes/vars are only an extra layer that stops the most
 * common injection vectors from even reaching the process.
 */
const BLOCKED_ENV_PREFIXES = ['LD_', 'DYLD_'];
const BLOCKED_ENV_VARS = new Set([
  'NODE_OPTIONS',
  'NODE_PATH',
  'PYTHONPATH',
  'PYTHONSTARTUP',
  'BASH_ENV',
  'ENV',
  'IFS',
  'GIT_SSH',
  'GIT_SSH_COMMAND',
  'PERL5OPT',
  'RUBYOPT',
  'GCONV_PATH',
  'PATH',
  'JAVA_TOOL_OPTIONS',
  '_JAVA_OPTIONS',
]);

function isBlockedEnvVar(key: string): boolean {
  if (BLOCKED_ENV_VARS.has(key)) return true;
  return BLOCKED_ENV_PREFIXES.some(prefix => key.startsWith(prefix));
}

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
  transport: StdioClientTransport;
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

  /** Return the command+args+env string for a server (for display before connecting). */
  getServerCommand(name: string): string | undefined {
    const cfg = this.configs.get(name);
    if (!cfg) return undefined;
    const args = cfg.args.length > 0 ? ` ${cfg.args.join(' ')}` : '';
    const env = Object.keys(cfg.env).length > 0 ? ` env=${JSON.stringify(cfg.env)}` : '';
    return `${cfg.command}${args}${env}`;
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
      const safeEnv: Record<string, string> = {};
      for (const [key, value] of Object.entries(config.env)) {
        if (!isBlockedEnvVar(key)) {
          safeEnv[key] = value;
        }
      }
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: safeEnv,
      });
      const client = new Client({ name: 'wardayacode', version: '0.6.1' });

      // Mid-session server crash: when the child process dies, the transport
      // fires onclose. Mark the server disconnected and drop its tools so the
      // agent stops seeing them and /mcp status reflects reality.
      transport.onclose = () => {
        this.handleServerClose(name);
      };

      await client.connect(transport);

      const { tools } = await client.listTools();
      const toolInfos: McpToolInfo[] = tools.map(t => ({
        name: t.name,
        description: t.description ?? '',
        inputSchema: t.inputSchema as Record<string, unknown>,
      }));

      this.connections.set(name, { config, client, transport, tools: toolInfos });

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

    this.unregisterTools(name, conn);

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

  /**
   * Best-effort synchronous kill of all live server processes, for use in a
   * `process.on('exit')` handler (which cannot await). Tree-kills each server's
   * child process so servers that ignore stdin EOF don't get orphaned.
   */
  killAllSync(): void {
    for (const conn of this.connections.values()) {
      const pid = conn.transport.pid;
      if (pid) {
        treeKill(pid, 'SIGTERM', () => {});
      }
    }
  }

  /** Shared by disconnect() and the crash handler. Idempotent. */
  private unregisterTools(name: string, conn: McpConnection): void {
    for (const t of conn.tools) {
      this.registry.unregister(`mcp__${name}__${t.name}`);
    }
  }

  private handleServerClose(name: string): void {
    const conn = this.connections.get(name);
    if (!conn) return;
    this.unregisterTools(name, conn);
    this.connections.delete(name);
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
