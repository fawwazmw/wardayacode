import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedVersion: string | null = null;

/**
 * Reads the package version from the nearest package.json named "wardayacode".
 *
 * Walks up from this module's directory so it resolves correctly in both the
 * source layout (src/utils/version.ts during `npm run dev`) and the bundled
 * layout (dist/cli.js after `npm run build`).
 */
export function getCurrentVersion(): string {
  if (cachedVersion) return cachedVersion;

  let dir = dirname(fileURLToPath(import.meta.url));

  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === 'wardayacode' && pkg.version) {
        cachedVersion = pkg.version;
        return cachedVersion;
      }
    } catch {
      // no package.json at this level — keep walking up
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  cachedVersion = '0.0.0';
  return cachedVersion;
}
