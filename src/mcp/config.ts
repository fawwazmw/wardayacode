import fs from 'fs/promises';
import path from 'path';

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * Load MCP server configs from .wardayacode/mcp/*.json and .mcp.json
 * (project root), merged. .mcp.json wins on name collisions. Servers
 * without a command are skipped.
 */
export async function loadMcpConfig(projectRoot: string): Promise<Map<string, McpServerConfig>> {
  const servers = new Map<string, McpServerConfig>();

  // 1. .wardayacode/mcp/*.json — one server per file
  const mcpDir = path.join(projectRoot, '.wardayacode', 'mcp');
  try {
    const files = (await fs.readdir(mcpDir)).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = await fs.readFile(path.join(mcpDir, file), 'utf-8');
        const cfg = JSON.parse(raw) as Partial<McpServerConfig>;
        if (!cfg.command || typeof cfg.command !== 'string') continue;
        const name = cfg.name ?? file.replace('.json', '');
        servers.set(name, {
          name,
          command: cfg.command,
          args: cfg.args ?? [],
          env: cfg.env ?? {},
        });
      } catch {
        // skip unreadable/invalid config file
      }
    }
  } catch {
    // no .wardayacode/mcp directory — ignore
  }

  // 2. .mcp.json — wins on name collisions
  try {
    const raw = await fs.readFile(path.join(projectRoot, '.mcp.json'), 'utf-8');
    const parsed = JSON.parse(raw) as {
      mcpServers?: Record<string, { command?: string; args?: string[]; env?: Record<string, string> }>;
    };
    for (const [name, cfg] of Object.entries(parsed.mcpServers ?? {})) {
      if (!cfg?.command) continue;
      servers.set(name, {
        name,
        command: cfg.command,
        args: cfg.args ?? [],
        env: cfg.env ?? {},
      });
    }
  } catch {
    // no .mcp.json — ignore
  }

  return servers;
}
