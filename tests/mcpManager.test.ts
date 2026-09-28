import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockClientCtor, mockTransportCtor, mockTreeKill } = vi.hoisted(() => ({
  mockClientCtor: vi.fn(),
  mockTransportCtor: vi.fn(),
  mockTreeKill: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: mockClientCtor,
}));
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: mockTransportCtor,
}));
vi.mock('tree-kill', () => ({ default: mockTreeKill }));

vi.mock('../src/mcp/config.js', () => ({
  loadMcpConfig: vi.fn(),
}));

import { McpManager } from '../src/mcp/McpManager.js';
import { loadMcpConfig } from '../src/mcp/config.js';

const mockLoadMcpConfig = loadMcpConfig as ReturnType<typeof vi.fn>;

class MockRegistry {
  registered: string[] = [];
  register(t: { definition: { name: string } }): void {
    this.registered.push(t.definition.name);
  }
  unregister(name: string): void {
    this.registered = this.registered.filter(n => n !== name);
  }
}

describe('McpManager', () => {
  let manager: McpManager;
  let registry: MockRegistry;
  let clientInstance: {
    connect: ReturnType<typeof vi.fn>;
    listTools: ReturnType<typeof vi.fn>;
    callTool: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  interface MockTransport {
    start: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    pid: number | null;
    onclose?: () => void;
  }

  let transportInstance: MockTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MockRegistry();
    clientInstance = {
      connect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'read', description: 'Read', inputSchema: { type: 'object' } }] }),
      callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'hello' }] }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    transportInstance = { start: vi.fn(), close: vi.fn(), pid: 12345 };
    mockClientCtor.mockImplementation(() => clientInstance);
    mockTransportCtor.mockImplementation(() => transportInstance);
    mockLoadMcpConfig.mockResolvedValue(new Map([
      ['filesystem', { name: 'filesystem', command: 'npx', args: ['-y', 'server-fs'], env: {} }],
    ]));
    manager = new McpManager(registry as never);
  });

  it('loads config names', async () => {
    await manager.loadConfig('/tmp/project');
    expect(manager.getConfigNames()).toEqual(['filesystem']);
  });

  it('returns the command for a configured server', async () => {
    await manager.loadConfig('/tmp/project');
    expect(manager.getServerCommand('filesystem')).toBe('npx -y server-fs');
    expect(manager.getServerCommand('unknown')).toBeUndefined();
  });

  it('includes env in the returned command string when present', async () => {
    mockLoadMcpConfig.mockResolvedValue(new Map([
      ['filesystem', { name: 'filesystem', command: 'npx', args: ['-y', 'server-fs'], env: { GITHUB_TOKEN: 'secret', FOO: 'bar' } }],
    ]));
    await manager.loadConfig('/tmp/project');
    const cmd = manager.getServerCommand('filesystem');
    expect(cmd).toContain('npx -y server-fs');
    expect(cmd).toContain('env=');
    expect(cmd).toContain('GITHUB_TOKEN');
  });

  it('filters blocked env vars before spawning', async () => {
    mockLoadMcpConfig.mockResolvedValue(new Map([
      ['filesystem', {
        name: 'filesystem',
        command: 'npx',
        args: ['-y', 'server-fs'],
        env: {
          LD_PRELOAD: '/tmp/evil.so',
          DYLD_LIBRARY_PATH: '/tmp/evil-dylibs',
          NODE_PATH: '/tmp/evil-node',
          GITHUB_TOKEN: 'secret',
        },
      }],
    ]));
    await manager.loadConfig('/tmp/project');
    await manager.connect('filesystem');
    expect(mockTransportCtor).toHaveBeenCalledTimes(1);
    const transportEnv = mockTransportCtor.mock.calls[0]?.[0]?.env ?? {};
    expect(transportEnv).not.toHaveProperty('LD_PRELOAD');
    expect(transportEnv).not.toHaveProperty('DYLD_LIBRARY_PATH');
    expect(transportEnv).not.toHaveProperty('NODE_PATH');
    expect(transportEnv.GITHUB_TOKEN).toBe('secret');
  });

  it('connects a server and registers its tools', async () => {
    await manager.loadConfig('/tmp/project');
    const msg = await manager.connect('filesystem');
    expect(msg).toContain('Connected to filesystem');
    expect(msg).toContain('1 tools');
    expect(registry.registered).toEqual(['mcp__filesystem__read']);
    expect(clientInstance.connect).toHaveBeenCalled();
    expect(clientInstance.listTools).toHaveBeenCalled();
  });

  it('closes the transport when connect fails', async () => {
    await manager.loadConfig('/tmp/project');
    clientInstance.connect.mockRejectedValueOnce(new Error('spawn failed'));

    const msg = await manager.connect('filesystem');
    expect(msg).toContain('Failed to connect');
    expect(transportInstance.close).toHaveBeenCalled();
    expect(manager.getStatus()[0]?.status).toBe('disconnected');
  });

  it('reports status connected/disconnected', async () => {
    await manager.loadConfig('/tmp/project');
    expect(manager.getStatus()[0]?.status).toBe('disconnected');
    await manager.connect('filesystem');
    expect(manager.getStatus()[0]?.status).toBe('connected');
  });

  it('disconnects and unregisters tools', async () => {
    await manager.loadConfig('/tmp/project');
    await manager.connect('filesystem');
    const msg = await manager.disconnect('filesystem');
    expect(msg).toContain('Disconnected');
    expect(registry.registered).toEqual([]);
    expect(clientInstance.close).toHaveBeenCalled();
  });

  it('returns error when calling tool on disconnected server', async () => {
    await manager.loadConfig('/tmp/project');
    const result = await manager.callTool('filesystem', 'read', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('not connected');
  });

  it('translates callTool result to ToolResult', async () => {
    await manager.loadConfig('/tmp/project');
    await manager.connect('filesystem');
    const result = await manager.callTool('filesystem', 'read', { path: '/tmp' });
    expect(result).toEqual({ success: true, content: 'hello' });
  });

  it('translates isError to failure', async () => {
    await manager.loadConfig('/tmp/project');
    await manager.connect('filesystem');
    clientInstance.callTool.mockResolvedValue({ content: [{ type: 'text', text: 'boom' }], isError: true });
    const result = await manager.callTool('filesystem', 'read', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('handles connect failure gracefully', async () => {
    await manager.loadConfig('/tmp/project');
    clientInstance.connect.mockRejectedValue(new Error('spawn failed'));
    const msg = await manager.connect('filesystem');
    expect(msg).toContain('Failed to connect');
    expect(registry.registered).toEqual([]);
  });

  it('disconnectAll closes everything', async () => {
    await manager.loadConfig('/tmp/project');
    await manager.connect('filesystem');
    await manager.disconnectAll();
    expect(clientInstance.close).toHaveBeenCalled();
    expect(manager.getStatus()[0]?.status).toBe('disconnected');
  });

  it('marks a crashed server disconnected and unregisters its tools', async () => {
    await manager.loadConfig('/tmp/project');
    await manager.connect('filesystem');
    expect(registry.registered).toEqual(['mcp__filesystem__read']);
    expect(manager.getStatus()[0]?.status).toBe('connected');

    // Simulate the server process dying — the transport fires onclose.
    transportInstance.onclose?.();

    expect(manager.getStatus()[0]?.status).toBe('disconnected');
    expect(manager.getStatus()[0]?.toolCount).toBe(0);
    expect(registry.registered).toEqual([]);

    // Subsequent tool calls fail cleanly.
    const result = await manager.callTool('filesystem', 'read', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('not connected');
  });

  it('is idempotent when onclose fires after a manual disconnect', async () => {
    await manager.loadConfig('/tmp/project');
    await manager.connect('filesystem');
    await manager.disconnect('filesystem');
    // No crash: onclose after disconnect is a no-op (connection already gone).
    transportInstance.onclose?.();
    expect(manager.getStatus()[0]?.status).toBe('disconnected');
    expect(registry.registered).toEqual([]);
  });

  it('killAllSync tree-kills live server processes without throwing', async () => {
    mockTreeKill.mockImplementation((_pid: number, _sig: string, cb: () => void) => cb());
    await manager.loadConfig('/tmp/project');
    await manager.connect('filesystem');
    expect(() => manager.killAllSync()).not.toThrow();
    expect(mockTreeKill).toHaveBeenCalledWith(12345, 'SIGTERM', expect.any(Function));
  });

  it('killAllSync is a no-op with no connections', async () => {
    await manager.loadConfig('/tmp/project');
    expect(() => manager.killAllSync()).not.toThrow();
    expect(mockTreeKill).not.toHaveBeenCalled();
  });
});
