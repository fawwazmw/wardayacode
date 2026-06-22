export interface ToolOutputPreview {
  /** The lines to display, capped at maxLines. */
  lines: string[];
  /** How many lines were omitted below the cap (0 when nothing was hidden). */
  hiddenCount: number;
}

/**
 * Build a collapsed preview of a tool's output for the chat UI: the first
 * `maxLines` lines plus a count of how many more were hidden. Trailing blank
 * lines are dropped so the "… +N lines" hint reflects real content, and
 * whitespace-only output yields no lines at all (nothing to render).
 */
export function previewToolOutput(content: string, maxLines: number): ToolOutputPreview {
  if (content.trim() === '') {
    return { lines: [], hiddenCount: 0 };
  }

  // Drop trailing newlines/blank lines so a single command's output doesn't
  // report phantom hidden lines from a trailing "\n".
  const trimmed = content.replace(/\n+$/, '');
  const allLines = trimmed.split('\n');

  if (maxLines <= 0) {
    return { lines: [], hiddenCount: allLines.length };
  }

  if (allLines.length <= maxLines) {
    return { lines: allLines, hiddenCount: 0 };
  }

  return {
    lines: allLines.slice(0, maxLines),
    hiddenCount: allLines.length - maxLines,
  };
}
