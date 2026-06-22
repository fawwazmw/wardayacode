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

  it('renders expandedOutput as verbatim full output in the live region', () => {
    const { lastFrame } = render(
      <ChatView
        messages={[]}
        streamingText=""
        themeMode="dark"
        expandedOutput={{ toolName: 'bash', content: 'line A\nline B\nline C' }}
      />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('bash (full output)');
    expect(out).toContain('line A');
    expect(out).toContain('line C');
  });

  it('omits the full output when expandedOutput is null (collapsed)', () => {
    const { lastFrame } = render(
      <ChatView messages={[]} streamingText="" themeMode="dark" expandedOutput={null} />,
    );
    const out = lastFrame() ?? '';
    expect(out).not.toContain('full output');
  });

  it('shows the streaming cursor while text is streaming', () => {
    const { lastFrame } = render(
      <ChatView messages={[]} streamingText="thinking out loud" themeMode="dark" />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('thinking out loud');
  });
});
