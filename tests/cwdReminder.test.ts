import { describe, it, expect } from 'vitest';
import type { CoreMessage } from 'ai';
import { injectCwdReminder, buildCwdReminder } from '../src/agent/cwdReminder.js';

describe('buildCwdReminder', () => {
  it('includes the exact cwd and a do-not-invent instruction', () => {
    const reminder = buildCwdReminder('/home/fawwazmw/project');
    expect(reminder).toContain('/home/fawwazmw/project');
    expect(reminder.toLowerCase()).toContain('working directory');
  });
});

describe('injectCwdReminder', () => {
  const cwd = '/home/fawwazmw/project';

  it('appends a reminder to the last user message', () => {
    const messages: CoreMessage[] = [
      { role: 'user', content: 'what is the cwd?' },
    ];
    const out = injectCwdReminder(messages, cwd);
    const last = out[out.length - 1]!;
    expect(last.role).toBe('user');
    expect(String(last.content)).toContain('what is the cwd?');
    expect(String(last.content)).toContain(cwd);
  });

  it('targets the LAST user message when assistant/tool messages follow earlier ones', () => {
    const messages: CoreMessage[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second' },
    ];
    const out = injectCwdReminder(messages, cwd);
    // first user message is untouched
    expect(String(out[0]!.content)).toBe('first');
    // last user message carries the reminder
    expect(String(out[2]!.content)).toContain('second');
    expect(String(out[2]!.content)).toContain(cwd);
  });

  it('does not mutate the original messages array or its items', () => {
    const messages: CoreMessage[] = [{ role: 'user', content: 'hello' }];
    const snapshot = JSON.parse(JSON.stringify(messages));
    injectCwdReminder(messages, cwd);
    expect(messages).toEqual(snapshot);
  });

  it('returns messages unchanged when there is no user message', () => {
    const messages: CoreMessage[] = [{ role: 'assistant', content: 'hi' }];
    const out = injectCwdReminder(messages, cwd);
    expect(out).toEqual(messages);
  });

  it('preserves array-style (multi-part) user content by appending a text part', () => {
    const messages: CoreMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'look at this' }] },
    ];
    const out = injectCwdReminder(messages, cwd);
    const last = out[out.length - 1]!;
    expect(Array.isArray(last.content)).toBe(true);
    const parts = last.content as Array<{ type: string; text?: string }>;
    expect(parts[0]).toEqual({ type: 'text', text: 'look at this' });
    expect(parts[parts.length - 1]!.type).toBe('text');
    expect(parts[parts.length - 1]!.text).toContain(cwd);
  });

  it('does not double-inject if a reminder is already present', () => {
    const messages: CoreMessage[] = [{ role: 'user', content: 'hello' }];
    const once = injectCwdReminder(messages, cwd);
    const twice = injectCwdReminder(once, cwd);
    const content = String(twice[twice.length - 1]!.content);
    // The cwd marker should appear exactly once.
    const occurrences = content.split(cwd).length - 1;
    expect(occurrences).toBe(1);
  });
});
