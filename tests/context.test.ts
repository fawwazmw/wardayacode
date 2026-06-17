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

  it('deduplicates consecutive identical messages', async () => {
    const ctx = new ContextManager();
    const msg = makeMessage('user', 'hello');
    ctx.addMessage(msg);
    ctx.addMessage({ ...msg, id: 'dup' });

    const result = await ctx.compact();
    expect(result.messages).toHaveLength(1);
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
    expect(result.tokenCount).toBe(100);
  });
});
