import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ToolCallView } from '../src/ui/ToolCallView.js';

describe('ToolCallView', () => {
  it('renders successful output under a connector', () => {
    const { lastFrame } = render(
      <ToolCallView
        toolName="bash"
        args={{ command: 'echo hi' }}
        result={{ success: true, content: 'hello\nworld' }}
        themeMode="dark"
      />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('⎿');
    expect(out).toContain('hello');
    expect(out).toContain('world');
  });

  it('collapses long output and shows the hidden-line count', () => {
    const content = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
    const { lastFrame } = render(
      <ToolCallView
        toolName="bash"
        args={{ command: 'seq 10' }}
        result={{ success: true, content }}
        themeMode="dark"
      />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('line 1');
    expect(out).toContain('line 4');
    expect(out).not.toContain('line 5');
    expect(out).toContain('+6 lines (ctrl+o to expand)');
  });

  it('renders the error text on failure', () => {
    const { lastFrame } = render(
      <ToolCallView
        toolName="bash"
        args={{ command: 'false' }}
        result={{ success: false, error: 'command failed: exit 1' }}
        themeMode="dark"
      />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('✗');
    expect(out).toContain('command failed: exit 1');
  });

  it('shows no output block while the call is in progress', () => {
    const { lastFrame } = render(
      <ToolCallView
        toolName="bash"
        args={{ command: 'sleep 5' }}
        startedAt={Date.now()}
        themeMode="dark"
      />,
    );
    const out = lastFrame() ?? '';
    expect(out).not.toContain('⎿');
  });
});
