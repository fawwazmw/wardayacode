import { describe, it, expect, vi } from 'vitest';
import { McpTool } from '../src/mcp/McpTool.js';

const mockCallTool = vi.fn();

class MockManager {
  callTool = mockCallTool;
}

describe('McpTool', () => {
  it('builds a namespaced definition', () => {
    const tool = new McpTool(new MockManager() as never, 'github', 'create_issue', 'Creates an issue', {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    });
    expect(tool.definition.name).toBe('mcp__github__create_issue');
    expect(tool.definition.description).toBe('Creates an issue');
    expect(tool.definition.requiresPermission).toBe(true);
    expect(tool.definition.concurrency).toBe('concurrent');
  });

  it('delegates execute to the manager callTool', async () => {
    mockCallTool.mockResolvedValue({ success: true, content: 'done' });
    const tool = new McpTool(new MockManager() as never, 'github', 'create_issue', '', { type: 'object' });
    const result = await tool.execute({ title: 'Bug' });
    expect(mockCallTool).toHaveBeenCalledWith('github', 'create_issue', { title: 'Bug' });
    expect(result.success).toBe(true);
  });
});
