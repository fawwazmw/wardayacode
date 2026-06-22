import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { InputBar } from '../src/ui/InputBar.js';

/** Ink delivers Enter as '\r' and Ctrl+J as '\n' through the same stdin path. */
const ENTER = '\r';
const CTRL_J = '\n';
const ESC = '\x1b';

/**
 * Let React flush state and re-register useInput's handler between keystrokes.
 * In a real terminal keystrokes land on separate ticks; back-to-back synchronous
 * writes would all see the same stale closure.
 */
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('InputBar newline handling', () => {
  it('Ctrl+J inserts a newline and Enter submits the multi-line text', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <InputBar onSubmit={onSubmit} isLoading={false} themeMode="dark" />,
    );
    await tick(); // let Ink attach its stdin data listener

    stdin.write('line one'); await tick();
    stdin.write(CTRL_J); await tick();
    stdin.write('line two'); await tick();
    stdin.write(ENTER); await tick();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('line one\nline two');
  });

  it('plain Enter submits a single line', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <InputBar onSubmit={onSubmit} isLoading={false} themeMode="dark" />,
    );
    await tick(); // let Ink attach its stdin data listener

    stdin.write('just one line'); await tick();
    stdin.write(ENTER); await tick();

    expect(onSubmit).toHaveBeenCalledWith('just one line');
  });
});

describe('InputBar interrupt', () => {
  it('Esc interrupts the running agent while loading', async () => {
    const onSubmit = vi.fn();
    const onInterrupt = vi.fn();
    const { stdin } = render(
      <InputBar
        onSubmit={onSubmit}
        isLoading={true}
        themeMode="dark"
        onInterrupt={onInterrupt}
      />,
    );
    await tick();

    stdin.write(ESC); await tick();

    expect(onInterrupt).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Esc does not call onInterrupt when idle', async () => {
    const onInterrupt = vi.fn();
    const { stdin } = render(
      <InputBar
        onSubmit={vi.fn()}
        isLoading={false}
        themeMode="dark"
        onInterrupt={onInterrupt}
      />,
    );
    await tick();

    stdin.write(ESC); await tick();

    expect(onInterrupt).not.toHaveBeenCalled();
  });
});
