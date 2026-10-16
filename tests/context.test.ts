import { describe, it, expect } from 'vitest';
import { ContextManager } from '../src/context/ContextManager.js';
import type { Message } from '../src/types.js';

function makeMessage(role: 'user' | 'assistant', content: string, type?: 'tool_result'): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    ...(type ? { type } : {}),
  };
}

describe('ContextManager', () => {
  it('adds and retrieves messages', () => {
    const ctx = new ContextManager();
    ctx.addMessage(makeMessage('user', 'hello'));
    ctx.addMessage(makeMessage('assistant', 'hi'));

    expect(ctx.getMessages()).toHaveLength(2);
    expect(ctx.getMessageCount()).toBe(2);
  });

  it('preserves distinct consecutive turns with identical text', async () => {
    const ctx = new ContextManager();
    ctx.addMessage(makeMessage('user', 'continue'));
    ctx.addMessage(makeMessage('user', 'continue'));

    const result = await ctx.compact();
    expect(result.messages).toHaveLength(2);
  });

  it('collapses an exact duplicate message id', async () => {
    const ctx = new ContextManager();
    const msg = makeMessage('user', 'hello');
    ctx.addMessage(msg);
    ctx.addMessage({ ...msg });

    const result = await ctx.compact();
    expect(result.messages).toHaveLength(1);
  });

  it('keeps a user-first window when compacting under pressure', async () => {
    const ctx = new ContextManager('/tmp', 200);
    ctx.addMessage(makeMessage('assistant', 'a'.repeat(400)));
    ctx.addMessage(makeMessage('user', 'u'.repeat(100)));

    const result = await ctx.compact();
    const firstReal = result.messages.find(m => m.role !== 'system');
    expect(firstReal?.role).toBe('user');
  });

  it('keeps non-consecutive duplicates', async () => {
    const ctx = new ContextManager();
    ctx.addMessage(makeMessage('user', 'hello'));
    ctx.addMessage(makeMessage('assistant', 'hi'));
    ctx.addMessage(makeMessage('user', 'hello'));

    const result = await ctx.compact();
    expect(result.messages).toHaveLength(3);
  });

  it('truncates old tool results when over 50% budget', async () => {
    const ctx = new ContextManager('/tmp', 20_000);

    for (let i = 0; i < 30; i++) {
      ctx.addMessage(makeMessage('user', `question ${i}`));
      const longContent = 'line\n'.repeat(600);
      ctx.addMessage(makeMessage('assistant', longContent, 'tool_result'));
    }

    const result = await ctx.compact();

    const earlyToolResults = result.messages.filter(
      (m, idx) => idx < 20 && m.type === 'tool_result'
    );

    expect(earlyToolResults.length).toBeGreaterThan(0);
    for (const msg of earlyToolResults) {
      expect(msg.content.length).toBeLessThan(3000);
      expect(msg.content).toContain('truncated');
    }
  });

  it('clears transcript', () => {
    const ctx = new ContextManager();
    ctx.addMessage(makeMessage('user', 'hello'));
    ctx.clear();
    expect(ctx.getMessages()).toHaveLength(0);
  });

  it('reports token count', async () => {
    const ctx = new ContextManager();
    ctx.addMessage(makeMessage('user', 'a'.repeat(400)));

    const result = await ctx.compact();
    expect(result.tokenCount).toBe(164); // 400 chars * 0.4 + 4 per-message overhead
  });

  it('shouldCompact returns false when under threshold', () => {
    const ctx = new ContextManager('/tmp', 100_000);
    ctx.addMessage(makeMessage('user', 'hello'));
    expect(ctx.shouldCompact()).toBe(false);
  });

  it('shouldCompact returns true when over 70% of budget', () => {
    const ctx = new ContextManager('/tmp', 100);
    // Each char ~0.4 tokens + 4 overhead; 240 chars * 0.4 + 4 = 100 tokens = 100% budget
    ctx.addMessage(makeMessage('user', 'a'.repeat(240)));
    expect(ctx.shouldCompact()).toBe(true);
  });

  it('addCoreMessage adds user and assistant messages', () => {
    const ctx = new ContextManager();
    ctx.addCoreMessage('user', 'hello');
    ctx.addCoreMessage('assistant', 'world');
    expect(ctx.getMessageCount()).toBe(2);
  });

  it('toCoreMessages filters to user/assistant only', () => {
    const ctx = new ContextManager();
    ctx.addMessage({ id: '1', role: 'system', content: 'sys', timestamp: Date.now() });
    ctx.addCoreMessage('user', 'hello');
    ctx.addCoreMessage('assistant', 'hi');

    const core = ctx.toCoreMessages();
    expect(core).toHaveLength(2);
    expect(core[0]!.role).toBe('user');
    expect(core[1]!.role).toBe('assistant');
  });

  it('reconstructs tool calls and results into core messages', () => {
    const ctx = new ContextManager();
    ctx.addCoreMessage('user', 'read the file');
    ctx.addMessage({
      id: 'u1',
      role: 'assistant',
      content: '',
      type: 'tool_use',
      toolName: 'read_file',
      toolInput: { filePath: '/a.ts' },
      toolCallId: 'c1',
      timestamp: Date.now(),
    });
    ctx.addMessage({
      id: 'r1',
      role: 'assistant',
      content: '{"success":true}',
      type: 'tool_result',
      toolName: 'read_file',
      toolResult: { success: true, content: '...' },
      toolCallId: 'c1',
      timestamp: Date.now(),
    });
    ctx.addCoreMessage('assistant', 'Done.');

    const core = ctx.toCoreMessages();
    expect(core.map(m => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);

    const assistant = core[1]!;
    expect(Array.isArray(assistant.content)).toBe(true);
    const part = (assistant.content as Array<{ type: string; toolCallId: string }>)[0]!;
    expect(part.type).toBe('tool-call');
    expect(part.toolCallId).toBe('c1');

    const tool = core[2]!;
    expect(tool.role).toBe('tool');
  });

  it('drops leading non-user messages from reconstructed history', () => {
    const ctx = new ContextManager();
    ctx.addMessage({
      id: 'u1',
      role: 'assistant',
      content: '',
      type: 'tool_use',
      toolName: 'read_file',
      toolInput: {},
      toolCallId: 'c1',
      timestamp: Date.now(),
    });
    ctx.addCoreMessage('user', 'hi');

    const core = ctx.toCoreMessages();
    expect(core[0]!.role).toBe('user');
  });

  it('compact after clear starts fresh', async () => {
    const ctx = new ContextManager('/tmp', 100);
    ctx.addMessage(makeMessage('user', 'a'.repeat(240)));
    const compacted = await ctx.compact();
    ctx.clear();
    for (const m of compacted.messages) ctx.addMessage(m);
    expect(ctx.shouldCompact()).toBe(false); // compaction should have reduced tokens
  });
});
