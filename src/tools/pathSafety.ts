import { resolve, relative, isAbsolute, sep } from 'node:path';

/**
 * Throws if resolvedPath escapes outside rootDir (defaults to cwd).
 * Use this before any file I/O to prevent path traversal.
 *
 * Uses path.relative rather than string prefixes so it works with the
 * platform path separator and correctly rejects `..` escapes.
 */
export function assertPathContained(resolvedPath: string, rootDir: string = process.cwd()): void {
  const root = resolve(rootDir);
  const normalized = resolve(resolvedPath);
  const rel = relative(root, normalized);

  if (rel === '') return; // same path
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Path escape detected: "${resolvedPath}" is outside the project root`);
  }
}
