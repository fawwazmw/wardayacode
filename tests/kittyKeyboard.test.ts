import { describe, it, expect } from 'vitest';
import type { Key } from 'ink';
import { supportsKittyKeyboard, normalizeKittyKeys } from '../src/ui/kittyKeyboard.js';

/** A blank Ink Key with every flag false — the starting point Ink hands us. */
function emptyKey(): Key {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
  };
}

describe('supportsKittyKeyboard', () => {
  it('is true for kitty (KITTY_WINDOW_ID set) on a TTY', () => {
    expect(supportsKittyKeyboard({ KITTY_WINDOW_ID: '1' }, true)).toBe(true);
  });

  it('is true when TERM names a capable terminal', () => {
    expect(supportsKittyKeyboard({ TERM: 'xterm-kitty' }, true)).toBe(true);
    expect(supportsKittyKeyboard({ TERM: 'xterm-ghostty' }, true)).toBe(true);
    expect(supportsKittyKeyboard({ TERM: 'foot' }, true)).toBe(true);
  });

  it('is true for wezterm via TERM_PROGRAM / WEZTERM_PANE', () => {
    expect(supportsKittyKeyboard({ WEZTERM_PANE: '0' }, true)).toBe(true);
    expect(supportsKittyKeyboard({ TERM_PROGRAM: 'WezTerm' }, true)).toBe(true);
  });

  it('is false for an unknown terminal', () => {
    expect(supportsKittyKeyboard({ TERM: 'xterm-256color' }, true)).toBe(false);
  });

  it('is false when not attached to a TTY, even on a capable terminal', () => {
    expect(supportsKittyKeyboard({ KITTY_WINDOW_ID: '1' }, false)).toBe(false);
  });
});

describe('normalizeKittyKeys', () => {
  it('maps Shift+Enter (CSI 13;2u) to return+shift and clears input', () => {
    const { input, key } = normalizeKittyKeys('[13;2u', emptyKey());
    expect(input).toBe('');
    expect(key.return).toBe(true);
    expect(key.shift).toBe(true);
  });

  it('treats unmodified Enter (CSI 13u) as return without shift', () => {
    const { input, key } = normalizeKittyKeys('[13u', emptyKey());
    expect(input).toBe('');
    expect(key.return).toBe(true);
    expect(key.shift).toBe(false);
  });

  it('does not set shift for non-shift modifiers like Ctrl+Enter (CSI 13;5u)', () => {
    const { key } = normalizeKittyKeys('[13;5u', emptyKey());
    expect(key.return).toBe(true);
    expect(key.shift).toBe(false);
  });

  it('maps lone Esc (CSI 27u) to escape and clears input', () => {
    const { input, key } = normalizeKittyKeys('[27u', emptyKey());
    expect(input).toBe('');
    expect(key.escape).toBe(true);
  });

  it('maps modified Esc (CSI 27;3u) to escape', () => {
    const { key } = normalizeKittyKeys('[27;3u', emptyKey());
    expect(key.escape).toBe(true);
  });

  it('passes ordinary printable input through untouched', () => {
    const k = emptyKey();
    const { input, key } = normalizeKittyKeys('a', k);
    expect(input).toBe('a');
    expect(key).toBe(k);
  });
});
