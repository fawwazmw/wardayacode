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
  // CSI-u form: `\x1b[<codepoint>;<modifiers>u`, optionally with `:`-separated
  // sub-fields (e.g. alternate keycodes, event type). Ink strips the ESC, so we
  // see `[<codepoint>;<modifiers>u`. Parse the leading numbers of each field.
  const csiU = /^\[(\d+)(?::\d+)*(?:;(\d+)(?::\d+)*)?u$/.exec(input);
  if (!csiU) return { input, key };

  const codepoint = parseInt(csiU[1]!, 10);
  // Kitty encodes modifiers as bitmask + 1: shift=1, alt=2, ctrl=4, super=8.
  // Lock keys (num_lock=64, caps_lock=128) also land here, so mask the bits we
  // care about rather than matching the field exactly.
  const bitmask = csiU[2] ? parseInt(csiU[2], 10) - 1 : 0;
  const isShift = (bitmask & 0b0001) !== 0;
  const isAlt = (bitmask & 0b0010) !== 0;
  const isCtrl = (bitmask & 0b0100) !== 0;
  const isSuper = (bitmask & 0b1000) !== 0;

  // Enter (13): surface as Enter so the submit / newline branches fire. Shift or
  // any modifier means "newline, don't submit" — we map shift through so the
  // existing `key.return && key.shift` branch handles it.
  if (codepoint === 13) {
    return { input: '', key: { ...key, return: true, shift: isShift } };
  }

  // Lone Esc reports as `\x1b[27u` once the protocol is on.
  if (codepoint === 27) {
    return { input: '', key: { ...key, escape: true } };
  }

  // Ctrl+letter combos get disambiguated to CSI-u under the protocol (their
  // legacy C0 codes collide with named keys — Ctrl+J with line feed, etc.).
  // Reconstruct them so the UI's `key.ctrl && input === 'x'` branches keep
  // working. a–z arrive as their lowercase codepoint regardless of shift.
  if (isCtrl && codepoint >= 97 && codepoint <= 122) {
    const letter = String.fromCharCode(codepoint);
    // Ctrl+J is the multi-line newline shortcut; emit '\n' so the newline branch
    // (`input === '\n'`) fires the same way it does on non-protocol terminals.
    if (letter === 'j') {
      return { input: '\n', key: { ...key, ctrl: true } };
    }
    return {
      input: letter,
      key: { ...key, ctrl: true, shift: isShift, meta: isAlt || isSuper },
    };
  }

  return { input, key };
}
