import { describe, it, expect, vi } from 'vitest';
import { ToolRegistry } from '../src/tools/ToolRegistry.js';
import { Tool } from '../src/tools/Tool.js';
import type { ToolDefinition, ToolResult } from '../src/types.js';

// Minimal concrete tool for testing
class EchoTool extends Tool {
  definition: ToolDefinition = {
    name: 'echo',
    description: 'Echoes input back',
    inputSchema: {
      type: 'object',
      properties: { message: { type: 'string', description: 'message to echo' } },
      required: ['message'],
    },
    requiresPermission: false,
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return { success: true, content: String(input['message'] ?? '') };
  }
}

class FailTool extends Tool {
  definition: ToolDefinition = {
    name: 'fail',
    description: 'Always throws',
    inputSchema: { type: 'object', properties: {} },
    requiresPermission: false,
  };

  async execute(_input: Record<string, unknown>): Promise<ToolResult> {
    throw new Error('tool explosion');
  }
}

describe('ToolRegistry', () => {
  it('register() adds a tool by name', () => {
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    expect(registry.has('echo')).toBe(true);
  });

  it('has() returns false for unregistered tool', () => {
    const registry = new ToolRegistry();
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('get() returns the tool instance', () => {
    const registry = new ToolRegistry();
    const tool = new EchoTool();
    registry.register(tool);
    expect(registry.get('echo')).toBe(tool);
  });

  it('get() returns undefined for unknown tool', () => {
    const registry = new ToolRegistry();
    expect(registry.get('nope')).toBeUndefined();
  });

  it('list() returns all registered tools', () => {
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    registry.register(new FailTool());
    expect(registry.list()).toHaveLength(2);
  });

  it('getAvailableTools() returns tool definitions', () => {
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const defs = registry.getAvailableTools();
    expect(defs).toHaveLength(1);
    expect(defs[0]!.name).toBe('echo');
    expect(defs[0]!.description).toBeTruthy();
  });

  it('registering same name twice overwrites', () => {
    const registry = new ToolRegistry();
    const tool1 = new EchoTool();
    const tool2 = new EchoTool();
    registry.register(tool1);
    registry.register(tool2);
    expect(registry.list()).toHaveLength(1);
    expect(registry.get('echo')).toBe(tool2);
  });

  it('execute() returns error when tool not found', async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute('missing', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Tool not found');
  });

  it('execute() returns error on invalid input (missing required field)', async () => {
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const result = await registry.execute('echo', {}); // missing 'message'
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid input');
  });

  it('execute() calls tool.execute() and returns result', async () => {
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const result = await registry.execute('echo', { message: 'hello' });
    expect(result.success).toBe(true);
    expect(result.content).toBe('hello');
  });

  it('execute() catches thrown errors and returns failure', async () => {
    const registry = new ToolRegistry();
    registry.register(new FailTool());
    const result = await registry.execute('fail', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('tool explosion');
  });

  it('validateInput spy is called during execute()', async () => {
    const registry = new ToolRegistry();
    const tool = new EchoTool();
    const spy = vi.spyOn(tool, 'validateInput');
    registry.register(tool);
    await registry.execute('echo', { message: 'test' });
    expect(spy).toHaveBeenCalled();
  });
});
