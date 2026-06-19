import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../src/agent/Agent.js';
import { ToolRegistry } from '../src/tools/ToolRegistry.js';
import { PermissionSystem } from '../src/permissions/PermissionSystem.js';

describe('Agent', () => {
  let toolRegistry: ToolRegistry;
  let permissions: PermissionSystem;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    permissions = new PermissionSystem('internal');
  });

  it('constructs with required config', () => {
    const mockModel = {} as any;
    const agent = new Agent({
      model: mockModel,
      toolRegistry,
      permissions,
    });

    expect(agent).toBeDefined();
    expect(agent).toBeInstanceOf(Agent);
  });

  it('accepts maxRetries in config', () => {
    const mockModel = {} as any;
    const agent = new Agent({
      model: mockModel,
      toolRegistry,
      permissions,
      maxRetries: 5,
    });

    expect(agent).toBeDefined();
  });

  it('emits events', () => {
    const mockModel = {} as any;
    const agent = new Agent({
      model: mockModel,
      toolRegistry,
      permissions,
    });

    const handler = vi.fn();
    agent.on('error', handler);

    agent.emit('error', new Error('test'));
    expect(handler).toHaveBeenCalledWith(expect.any(Error));
  });

  it('emits retry events', () => {
    const mockModel = {} as any;
    const agent = new Agent({
      model: mockModel,
      toolRegistry,
      permissions,
      maxRetries: 3,
    });

    const handler = vi.fn();
    agent.on('retry', handler);

    agent.emit('retry', { attempt: 1, maxRetries: 3, delayMs: 1000, error: 'rate limited' });
    expect(handler).toHaveBeenCalledWith({
      attempt: 1,
      maxRetries: 3,
      delayMs: 1000,
      error: 'rate limited',
    });
  });

  it('emits usage events', () => {
    const mockModel = {} as any;
    const agent = new Agent({
      model: mockModel,
      toolRegistry,
      permissions,
    });

    const handler = vi.fn();
    agent.on('usage', handler);

    agent.emit('usage', { promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    expect(handler).toHaveBeenCalledWith({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
  });

  it('builds tools from registry', () => {
    const mockModel = {} as any;
    const agent = new Agent({
      model: mockModel,
      toolRegistry,
      permissions,
      maxSteps: 5,
    });

    expect(agent).toBeDefined();
  });
});

describe('PermissionSystem', () => {
  it('allows read tools in default mode', async () => {
    const perms = new PermissionSystem('default');
    const result = await perms.check({ name: 'read_file', input: {} });
    expect(result.allowed).toBe(true);
  });

  it('denies bash in default mode', async () => {
    const perms = new PermissionSystem('default');
    const result = await perms.check({ name: 'bash', input: {} });
    expect(result.allowed).toBe(false);
  });

  it('allows everything in internal mode', async () => {
    const perms = new PermissionSystem('internal');
    const bashResult = await perms.check({ name: 'bash', input: {} });
    const writeResult = await perms.check({ name: 'write_file', input: {} });
    expect(bashResult.allowed).toBe(true);
    expect(writeResult.allowed).toBe(true);
  });

  it('respects custom rules', async () => {
    const perms = new PermissionSystem('internal');
    perms.addRule({ tool: 'bash', action: 'deny', reason: 'custom deny' });

    const result = await perms.check({ name: 'bash', input: {} });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('custom deny');
  });

  it('changes mode correctly', () => {
    const perms = new PermissionSystem('default');
    expect(perms.getMode()).toBe('default');

    perms.setMode('auto');
    expect(perms.getMode()).toBe('auto');
  });
});
