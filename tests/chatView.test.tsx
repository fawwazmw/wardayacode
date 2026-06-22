import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ChatView, type ChatMessage } from '../src/ui/ChatView.js';

describe('ChatView', () => {
  it('renders settled messages and an in-progress tool call together', () => {
    const messages: ChatMessage[] = [
      { type: 'text', role: 'user', content: 'run the tests' },
      { type: 'tool_call', toolName: 'bash', args: { command: 'npm test' }, startedAt: Date.now() },
    ];
    const { lastFrame } = render(
      <ChatView messages={messages} streamingText="" themeMode="dark" />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('run the tests');
    expect(out).toContain('bash');
  });

  it('renders a tool_output entry as verbatim full output', () => {
    const messages: ChatMessage[] = [
      { type: 'tool_output', toolName: 'bash', content: 'line A\nline B\nline C' },
    ];
    const { lastFrame } = render(
      <ChatView messages={messages} streamingText="" themeMode="dark" />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('bash (full output)');
    expect(out).toContain('line A');
    expect(out).toContain('line C');
  });

  it('shows the streaming cursor while text is streaming', () => {
    const { lastFrame } = render(
      <ChatView messages={[]} streamingText="thinking out loud" themeMode="dark" />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('thinking out loud');
  });
});
