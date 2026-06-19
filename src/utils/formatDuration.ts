/**
 * Format an elapsed duration (in milliseconds) for display next to a finished
 * answer, e.g. "Done in 4.2s".
 *
 * - < 1s   → milliseconds  ("850ms")
 * - < 1m   → seconds, one decimal ("4.2s")
 * - >= 1m  → minutes and whole seconds ("2m 5s")
 */
export function formatDuration(ms: number): string {
  const clamped = ms > 0 ? ms : 0;

  if (clamped < 1000) {
    return `${Math.round(clamped)}ms`;
  }

  if (clamped < 60_000) {
    return `${(clamped / 1000).toFixed(1)}s`;
  }

  const totalSeconds = Math.round(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}
