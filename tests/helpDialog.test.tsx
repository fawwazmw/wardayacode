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
    stdin.write(TAB); await tick();
    const out = lastFrame() ?? '';
    // First command in the catalog is visible; a later one is scrolled off.
    expect(out).toContain('/add-dir');
    expect(out).toContain('Add a new working directory');
    expect(out).not.toContain('/theme');
    // Position indicator shows a 7-row window.
    expect(out).toContain('1–7 of');
  });

  it('Down arrow scrolls the commands list', async () => {
    const { stdin, lastFrame } = render(
      <HelpDialog themeMode="dark" onClose={vi.fn()} />,
    );
    await tick();
    stdin.write(TAB); await tick(); // → Commands section
    stdin.write(DOWN); await tick();
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
    stdin.write(RIGHT); await tick();
    stdin.write(RIGHT); await tick();
    const out = lastFrame() ?? '';
    expect(out).toContain('No custom commands yet.');
  });

  it('Left arrow from General wraps to Custom Commands', async () => {
    const { stdin, lastFrame } = render(
      <HelpDialog themeMode="dark" onClose={vi.fn()} />,
    );
    await tick();
    stdin.write(LEFT); await tick();
    const out = lastFrame() ?? '';
    expect(out).toContain('No custom commands yet.');
  });

  it('Esc closes the dialog', async () => {
    const onClose = vi.fn();
    const { stdin } = render(
      <HelpDialog themeMode="dark" onClose={onClose} />,
    );
    await tick();
    stdin.write(ESC); await tick();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
