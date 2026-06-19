import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const MODULE_NAME = 'wardayacode';
const REGISTRY_URL = `https://registry.npmjs.org/${MODULE_NAME}/latest`;
const CHECK_INTERVAL_MS = 1000 * 60 * 60 * 24; // once per day
const FETCH_TIMEOUT_MS = 3000;

export interface UpdateInfo {
  current: string;
  latest: string;
  updateAvailable: boolean;
}

interface UpdateCache {
  lastCheck: number;
  latest: string;
}

function getCachePath(): string {
  return path.join(os.homedir(), '.config', MODULE_NAME, 'update-check.json');
}

async function readCache(): Promise<UpdateCache | null> {
  try {
    const parsed = JSON.parse(await readFile(getCachePath(), 'utf-8')) as Partial<UpdateCache>;
    if (typeof parsed.lastCheck === 'number' && typeof parsed.latest === 'string') {
      return { lastCheck: parsed.lastCheck, latest: parsed.latest };
    }
    return null;
  } catch {
    return null;
  }
}

async function writeCache(cache: UpdateCache): Promise<void> {
  try {
    const file = getCachePath();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(cache), 'utf-8');
  } catch {
    // cache write failures are non-fatal
  }
}

/**
 * Fetches the latest published version from the npm registry.
 * Returns null on any network error, timeout, or unexpected response.
 */
export async function fetchLatestVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(REGISTRY_URL, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Compares two semver-ish version strings (x.y.z). A leading "v" and any
 * pre-release/build suffix (after "-" or "+") are ignored. Returns true when
 * `latest` is strictly greater than `current`.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string): number[] =>
    v.replace(/^v/, '').split(/[-+]/)[0]!.split('.').map(n => parseInt(n, 10) || 0);

  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/**
 * Returns update info for the CLI, using a 24h on-disk cache to avoid hitting
 * the npm registry on every startup. Safe to call from a React effect or a
 * plain await — it never throws and returns null when no data is available.
 */
export async function checkForUpdates(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const cache = await readCache();
    const now = Date.now();
    const fresh = cache !== null && now - cache.lastCheck < CHECK_INTERVAL_MS;

    let latest: string | null = cache?.latest ?? null;

    if (!fresh) {
      const fetched = await fetchLatestVersion();
      if (fetched) {
        latest = fetched;
        await writeCache({ lastCheck: now, latest: fetched });
      }
    }

    if (!latest) return null;

    return {
      current: currentVersion,
      latest,
      updateAvailable: isNewerVersion(latest, currentVersion),
    };
  } catch {
    return null;
  }
}
