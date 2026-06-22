import type { Key } from 'ink';

/**
 * Shift+Enter cannot be distinguished from a plain Enter in most terminals —
 * both arrive as a bare `\r`. The kitty keyboard protocol fixes this: when
 * enabled, the terminal disambiguates modified keys (Shift+Enter becomes a
 * distinct CSI sequence). We opt in only on terminals known to support it,
 * normalize the new sequences back into Ink's `Key` shape, and pop the protocol
 * on exit so the terminal is left exactly as we found it.
 *
 * Refs: https://sw.kovidgoyal.net/kitty/keyboard-protocol/
 */

/** Terminals that implement the kitty keyboard protocol. */
function isKittyCapableTerm(env: NodeJS.ProcessEnv): boolean {
  if (env.KITTY_WINDOW_ID) return true;
  const term = (env.TERM ?? '').toLowerCase();
  const termProgram = (env.TERM_PROGRAM ?? '').toLowerCase();
  if (term.includes('kitty') || term.includes('ghostty') || term.includes('foot')) {
    return true;
  }
  if (
    termProgram.includes('ghostty') ||
    termProgram.includes('wezterm') ||
    env.WEZTERM_PANE !== undefined
  ) {
    return true;
  }
  return false;
}

/**
 * True when the kitty keyboard protocol can be safely enabled: the terminal
 * supports it and we're attached to a real TTY (writing escape sequences into a
 * pipe or file would corrupt output).
 */
export function supportsKittyKeyboard(
  env: NodeJS.ProcessEnv = process.env,
  isTTY: boolean = Boolean(process.stdout.isTTY),
): boolean {
  return isTTY && isKittyCapableTerm(env);
}

let enabled = false;

/**
 * Push the kitty "disambiguate escape codes" flag (1). This is the minimal flag
 * that makes Shift+Enter distinguishable while leaving legacy keys (Ctrl+letter,
 * arrows, backspace, Tab) untouched. Idempotent; registers a best-effort restore
 * on process exit.
 */
export function enableKittyKeyboard(): void {
  if (enabled || !supportsKittyKeyboard()) return;
  process.stdout.write('\x1b[>1u');
  enabled = true;
  process.once('exit', disableKittyKeyboard);
}

/** Pop the kitty flag, restoring the terminal's prior keyboard mode. */
export function disableKittyKeyboard(): void {
  if (!enabled) return;
  process.stdout.write('\x1b[<u');
  enabled = false;
}

/**
 * Under the kitty protocol, Ink can't parse the new CSI-u sequences, so it
 * strips the leading ESC and hands us the remainder as `input` (e.g. Shift+Enter
 * → `[13;2u`, lone Esc → `[27u`). Map those back onto Ink's `Key` shape so the
 * rest of the UI keeps using `key.return`, `key.shift`, `key.escape` unchanged.
 *
 * Pure function — safe to unit test and call at the top of any `useInput`.
 */
export function normalizeKittyKeys(
  input: string,
  key: Key,
): { input: string; key: Key } {
  // Modified Enter: `\x1b[13;<mods>u`. Surface it as Enter+Shift so the existing
  // newline branch (`key.return && key.shift`) fires. mods: 2=shift, 3=alt,
  // 5=ctrl (kitty encodes mods as bitmask+1); we only care that it's modified.
  const enterMatch = /^\[13(?:;(\d+))?u$/.exec(input);
  if (enterMatch) {
    const mods = enterMatch[1] ? parseInt(enterMatch[1], 10) : 1;
    const isShift = ((mods - 1) & 0b1) === 1;
    return { input: '', key: { ...key, return: true, shift: isShift } };
  }

  // Lone Esc reports as `\x1b[27u` (or `\x1b[27;<mods>u`) once the protocol is on.
  if (/^\[27(?:;\d+)?u$/.test(input)) {
    return { input: '', key: { ...key, escape: true } };
  }

  return { input, key };
}
