import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadMcpConfig } from '../src/mcp/config.js';

describe('loadMcpConfig', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcp-config-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads servers from .mcp.json', async () => {
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify({
      mcpServers: {
        filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'], env: {} },
      },
    }));
    const servers = await loadMcpConfig(dir);
    expect(servers.get('filesystem')?.command).toBe('npx');
    expect(servers.get('filesystem')?.args).toContain('@modelcontextprotocol/server-filesystem');
  });

  it('loads servers from .wardayacode/mcp/*.json', async () => {
    const mcpDir = join(dir, '.wardayacode', 'mcp');
    mkdirSync(mcpDir, { recursive: true });
    writeFileSync(join(mcpDir, 'github.json'), JSON.stringify({
      name: 'github',
      command: 'node',
      args: ['server.js'],
      env: { GITHUB_TOKEN: 'abc' },
    }));
    const servers = await loadMcpConfig(dir);
    expect(servers.get('github')?.command).toBe('node');
    expect(servers.get('github')?.env.GITHUB_TOKEN).toBe('abc');
  });

  it('lets .mcp.json win on name collisions', async () => {
    const mcpDir = join(dir, '.wardayacode', 'mcp');
    mkdirSync(mcpDir, { recursive: true });
    writeFileSync(join(mcpDir, 'filesystem.json'), JSON.stringify({
      name: 'filesystem', command: 'old-cmd', args: [], env: {},
    }));
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify({
      mcpServers: { filesystem: { command: 'new-cmd', args: [], env: {} } },
    }));
    const servers = await loadMcpConfig(dir);
    expect(servers.get('filesystem')?.command).toBe('new-cmd');
  });

  it('skips servers without a command', async () => {
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify({
      mcpServers: { broken: { args: [] }, good: { command: 'cmd', args: [] } },
    }));
    const servers = await loadMcpConfig(dir);
    expect(servers.has('broken')).toBe(false);
    expect(servers.get('good')?.command).toBe('cmd');
  });

  it('returns empty map when no config exists', async () => {
    const servers = await loadMcpConfig(dir);
    expect(servers.size).toBe(0);
  });
});
