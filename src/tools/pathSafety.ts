import { resolve } from 'node:path';

/**
 * Throws if resolvedPath escapes outside rootDir (defaults to cwd).
 * Use this before any file I/O to prevent path traversal.
 */
export function assertPathContained(resolvedPath: string, rootDir: string = process.cwd()): void {
  const root = resolve(rootDir);
  const normalized = resolve(resolvedPath);
  if (!normalized.startsWith(root + '/') && normalized !== root) {
    throw new Error(`Path escape detected: "${resolvedPath}" is outside the project root`);
  }
}
