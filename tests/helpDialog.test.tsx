import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { HelpDialog } from '../src/ui/HelpDialog.js';

const TAB = '\t';
const ESC = '\x1b';
const RIGHT = '\x1b[C';
const LEFT = '\x1b[D';
const DOWN = '\x1b[B';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
/** Slower tick for CI environments where rendering may be deferred. */
const slowTick = () => new Promise<void>(resolve => setTimeout(resolve, 15));

describe('HelpDialog', () => {
  it('opens on the General section showing the shortcuts list', () => {
    const { lastFrame } = render(
      <HelpDialog themeMode="dark" onClose={vi.fn()} />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('General');
    expect(out).toContain('Commands');
    expect(out).toContain('Custom Commands');
    // Shortcut keys from each of the three columns render.
    expect(out).toContain('for bash mode');
    expect(out).toContain('double tap esc');
    expect(out).toContain('ctrl + shift + -');
  });

  it('Tab advances to the Commands section showing the first page of commands', async () => {
    const { stdin, lastFrame } = render(
      <HelpDialog themeMode="dark" onClose={vi.fn()} />,
    );
    await tick();
    stdin.write(TAB);
    await slowTick();
    const out = lastFrame() ?? '';
    // First command in the catalog is visible; a later one is scrolled off.
    expect(out).toContain('/add-dir');
    expect(out).toContain('Add a new working directory');
    expect(out).not.toContain('/theme');
    // Position indicator shows a 7-row window.
    expect(out).toContain('1–7 of');
  });

  it('flags catalog commands that are not yet implemented', async () => {
    const { stdin, lastFrame } = render(
      <HelpDialog themeMode="dark" onClose={vi.fn()} />,
    );
    await tick();
    stdin.write(TAB);
    await slowTick();
    const out = lastFrame() ?? '';
    // /add-dir isn't in the live registry, so it carries the "(soon)" marker,
    // and the legend explains it.
    expect(out).toContain('(soon)');
    expect(out).toContain('not yet available');
  });

  it('Down arrow scrolls the commands list', async () => {
    const { stdin, lastFrame } = render(
      <HelpDialog themeMode="dark" onClose={vi.fn()} />,
    );
    await tick();
    stdin.write(TAB);
    await slowTick();
    // Write down-arrow as a single chunk so \x1b doesn't split.
    stdin.write(DOWN);
    await slowTick();
    const out = lastFrame() ?? '';
    // Scrolled one row: the first command is gone, the window shifts down.
    expect(out).not.toContain('/add-dir');
    expect(out).toContain('2–8 of');
  });

  it('Right arrow then Right arrow reaches Custom Commands', async () => {
    const { stdin, lastFrame } = render(
      <HelpDialog themeMode="dark" onClose={vi.fn()} />,
    );
    await tick();
    // Write each arrow separately with a render tick between so React processes
    // each state update before the next key arrives.
    stdin.write(RIGHT);
    await slowTick();
    stdin.write(RIGHT);
    await slowTick();
    const out = lastFrame() ?? '';
    expect(out).toContain('No custom commands yet.');
  });

  it('Left arrow from General wraps to Custom Commands', async () => {
    const { stdin, lastFrame } = render(
      <HelpDialog themeMode="dark" onClose={vi.fn()} />,
    );
    await tick();
    stdin.write(LEFT);
    // Extra tick so Ink can process the escape-prefixed sequence fully even when
    // rendering is deferred (CI environments).
    await slowTick();
    const out = lastFrame() ?? '';
    expect(out).toContain('No custom commands yet.');
  });

  it('Esc closes the dialog', async () => {
    const onClose = vi.fn();
    const { stdin } = render(
      <HelpDialog themeMode="dark" onClose={onClose} />,
    );
    await tick();
    stdin.write(ESC);
    await slowTick();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
