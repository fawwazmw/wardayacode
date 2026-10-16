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

interface ParsedVersion {
  core: number[];
  pre: string | null;
}

function parseVersion(v: string): ParsedVersion {
  const cleaned = v.trim().replace(/^v/, '');
  const plusIdx = cleaned.indexOf('+');
  const withoutBuild = plusIdx === -1 ? cleaned : cleaned.slice(0, plusIdx);
  const dashIdx = withoutBuild.indexOf('-');
  const coreRaw = dashIdx === -1 ? withoutBuild : withoutBuild.slice(0, dashIdx);
  const preRaw = dashIdx === -1 ? '' : withoutBuild.slice(dashIdx + 1);
  const core = coreRaw.split('.').map(n => parseInt(n, 10) || 0);
  return { core, pre: preRaw.length > 0 ? preRaw : null };
}

function compareCore(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** semver pre-release precedence: numeric < alphanumeric, shorter < longer. */
function comparePrerelease(a: string, b: string): number {
  const pa = a.split('.');
  const pb = b.split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) {
      const dx = parseInt(x, 10);
      const dy = parseInt(y, 10);
      if (dx !== dy) return dx < dy ? -1 : 1;
    } else if (xn) {
      return -1;
    } else if (yn) {
      return 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Returns true when `latest` is a strictly higher semver than `current`.
 * Handles a leading `v`, build metadata (`+...`), and pre-release identifiers
 * (a pre-release is lower than its corresponding release).
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);

  const core = compareCore(l.core, c.core);
  if (core !== 0) return core > 0;

  // Same core version: a release outranks a pre-release.
  if (l.pre === null && c.pre === null) return false;
  if (l.pre === null) return true;
  if (c.pre === null) return false;
  return comparePrerelease(l.pre, c.pre) > 0;
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
