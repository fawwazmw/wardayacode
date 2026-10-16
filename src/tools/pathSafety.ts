import { resolve, relative, isAbsolute, sep } from 'node:path';

/**
 * Additional root directories allowed at runtime (via `/add-dir`). Kept
 * process-global so every tool's containment check honors them without
 * threading a workspace object through each tool.
 */
const extraRoots = new Set<string>();

function isContained(target: string, root: string): boolean {
  const rel = relative(root, target);
  if (rel === '') return true;
  return !(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel));
}

/** Allow an additional root directory. Returns the resolved absolute path. */
export function addAllowedRoot(rootDir: string): string {
  const abs = resolve(rootDir);
  extraRoots.add(abs);
  return abs;
}

/** Currently-allowed additional roots. */
export function getAllowedRoots(): string[] {
  return [...extraRoots];
}

/** Clear additional roots (used by tests). */
export function clearAllowedRoots(): void {
  extraRoots.clear();
}

/**
 * Throws if resolvedPath escapes outside rootDir (defaults to cwd) and all
 * additional roots. Use this before any file I/O to prevent path traversal.
 *
 * Uses path.relative rather than string prefixes so it works with the
 * platform path separator and correctly rejects `..` escapes.
 */
export function assertPathContained(resolvedPath: string, rootDir: string = process.cwd()): void {
  const normalized = resolve(resolvedPath);
  const roots = [resolve(rootDir), ...extraRoots];
  if (!roots.some(root => isContained(normalized, root))) {
    throw new Error(`Path escape detected: "${resolvedPath}" is outside the project root`);
  }
}
