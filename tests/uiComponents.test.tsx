import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBar } from '../src/ui/StatusBar.js';
import { CommandPalette } from '../src/ui/CommandPalette.js';
import { PermissionPrompt } from '../src/ui/PermissionPrompt.js';
import { WelcomeScreen } from '../src/ui/components/WelcomeScreen.js';
import type { SlashCommandEntry } from '../src/ui/SlashCommands.js';

/** Wait for Ink's useInput to register before sending keys in CI. */
const settle = () => new Promise<void>(r => setTimeout(r, 50));
const tick = () => new Promise<void>(r => setTimeout(r, 20));

describe('StatusBar', () => {
  it('shows the model, mode, and short session id', () => {
    const { lastFrame } = render(
      <StatusBar
        model="claude-opus-4-1"
        tokenUsage={{ input: 0, output: 0 }}
        permissionMode="plan"
        sessionId="abcdef12-3456-7890"
        themeMode="dark"
      />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('claude-opus-4-1');
    expect(out).toContain('plan');
    expect(out).toContain('abcdef12');
    expect(out).not.toContain('abcdef12-3456');
  });

  it('shows a token count only when tokens were used', () => {
    const { lastFrame } = render(
      <StatusBar
        model="m"
        tokenUsage={{ input: 1000, output: 500 }}
        permissionMode="default"
        sessionId="s"
        themeMode="light"
      />,
    );
    expect(lastFrame() ?? '').toContain('1.5k tokens');
  });

  it('omits the token count at zero usage', () => {
    const { lastFrame } = render(
      <StatusBar
        model="m"
        tokenUsage={{ input: 0, output: 0 }}
        permissionMode="default"
        sessionId="s"
        themeMode="dark"
      />,
    );
    expect(lastFrame() ?? '').not.toContain('tokens');
  });
});

describe('CommandPalette', () => {
  const commands: SlashCommandEntry[] = Array.from({ length: 15 }, (_, i) => ({
    name: `/cmd${i}`,
    description: `desc ${i}`,
  }));

  it('renders nothing when there are no commands', () => {
    const { lastFrame } = render(
      <CommandPalette commands={[]} selectedIndex={0} themeMode="dark" />,
    );
    expect((lastFrame() ?? '').trim()).toBe('');
  });

  it('renders a window with "more below" and marks the selection', () => {
    const { lastFrame } = render(
      <CommandPalette commands={commands} selectedIndex={0} themeMode="dark" />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('/cmd0');
    expect(out).toContain('▸');
    expect(out).toContain('↓ 5 more');
    expect(out).not.toContain('/cmd14');
  });

  it('scrolls the window with "more above" near the bottom', () => {
    const { lastFrame } = render(
      <CommandPalette commands={commands} selectedIndex={12} themeMode="dark" />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('↑ 5 more');
    expect(out).toContain('/cmd14');
  });
});

describe('PermissionPrompt', () => {
  const props = {
    toolName: 'write_file',
    args: { filePath: '/project/src/a.ts' },
    reason: 'File write requires approval',
    themeMode: 'dark' as const,
  };

  it('renders the tool name, args, and options', () => {
    const { lastFrame } = render(<PermissionPrompt {...props} onDecision={vi.fn()} />);
    const out = lastFrame() ?? '';
    expect(out).toContain('write_file');
    expect(out).toContain('/project/src/a.ts');
    expect(out).toContain('[Y]es');
    expect(out).toContain('[N]o');
    expect(out).toContain('[A]lways');
  });

  it('approves on "y"', async () => {
    const onDecision = vi.fn();
    const { stdin } = render(<PermissionPrompt {...props} onDecision={onDecision} />);
    await settle();
    stdin.write('y');
    await tick();
    expect(onDecision).toHaveBeenCalledWith('allow');
  });

  it('denies on "n"', async () => {
    const onDecision = vi.fn();
    const { stdin } = render(<PermissionPrompt {...props} onDecision={onDecision} />);
    await settle();
    stdin.write('n');
    await tick();
    expect(onDecision).toHaveBeenCalledWith('deny');
  });

  it('always-allows on "a"', async () => {
    const onDecision = vi.fn();
    const { stdin } = render(<PermissionPrompt {...props} onDecision={onDecision} />);
    await settle();
    stdin.write('a');
    await tick();
    expect(onDecision).toHaveBeenCalledWith('always');
  });
});

describe('WelcomeScreen', () => {
  it('renders branding, model, mode label, and cwd', () => {
    const { lastFrame } = render(
      <WelcomeScreen
        model="claude-sonnet-4"
        permissionMode="acceptEdits"
        sessionId="abc"
        cwd="/home/alice/proj"
        themeMode="dark"
        version="0.7.0"
      />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('Wardayacode');
    expect(out).toContain('v0.7.0');
    expect(out).toContain('claude-sonnet-4');
    expect(out).toContain('AcceptEdits');
    expect(out).toContain('~/proj');
    expect(out).not.toContain('Update available');
  });

  it('shows the update banner when a newer version is available', () => {
    const { lastFrame } = render(
      <WelcomeScreen
        model="m"
        permissionMode="default"
        sessionId="abc"
        cwd="/tmp/p"
        themeMode="dark"
        version="0.7.0"
        latestVersion="0.8.0"
        updateAvailable
      />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('Update available');
    expect(out).toContain('0.8.0');
  });
});
