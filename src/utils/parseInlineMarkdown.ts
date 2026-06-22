/**
 * A run of text with optional inline styling. Exactly one style flag is set at
 * a time (or none, for plain text). `code` spans are literal — markup inside
 * them is not interpreted.
 */
export interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

/**
 * Parse a single line of text into styled segments, handling `**bold**`,
 * `` `code` `` and `*italic*`. Backticks/asterisks are stripped from the
 * output. Unmatched markers are left as literal text, so prose like
 * "2 * 3 = 6" survives untouched.
 *
 * This is intentionally a small, single-pass scanner rather than a full
 * markdown engine — it covers the inline spans the assistant actually emits.
 */
export function parseInlineMarkdown(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let plain = '';

  const flushPlain = (): void => {
    if (plain.length > 0) {
      segments.push({ text: plain });
      plain = '';
    }
  };

  let i = 0;
  while (i < line.length) {
    const ch = line[i]!;

    // Inline code: `...` — literal, no nested markup.
    if (ch === '`') {
      const end = line.indexOf('`', i + 1);
      if (end > i + 1) {
        flushPlain();
        segments.push({ text: line.slice(i + 1, end), code: true });
        i = end + 1;
        continue;
      }
    }

    // Bold: **...** (checked before single-* so it wins).
    if (ch === '*' && line[i + 1] === '*') {
      const end = line.indexOf('**', i + 2);
      if (end > i + 1) {
        flushPlain();
        segments.push({ text: line.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }

    // Italic: *...* (single asterisk, non-empty, not immediately another *).
    if (ch === '*' && line[i + 1] !== '*') {
      const end = line.indexOf('*', i + 1);
      if (end > i + 1 && line[end + 1] !== '*') {
        flushPlain();
        segments.push({ text: line.slice(i + 1, end), italic: true });
        i = end + 1;
        continue;
      }
    }

    plain += ch;
    i++;
  }

  flushPlain();
  return segments;
}
