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

  it('renders each line of a multi-line user message on its own row', () => {
    const messages: ChatMessage[] = [
      { type: 'text', role: 'user', content: 'hello\n\ntesting' },
    ];
    const { lastFrame } = render(
      <ChatView messages={messages} streamingText="" themeMode="dark" />,
    );
    const out = lastFrame() ?? '';
    // Both content lines render (on separate rows), so the message reads as one
    // block rather than getting collapsed or split into disconnected inputs.
    expect(out).toContain('hello');
    expect(out).toContain('testing');
    const helloRow = out.split('\n').findIndex(l => l.includes('hello'));
    const testingRow = out.split('\n').findIndex(l => l.includes('testing'));
    expect(helloRow).toBeGreaterThanOrEqual(0);
    expect(testingRow).toBeGreaterThan(helloRow);
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
