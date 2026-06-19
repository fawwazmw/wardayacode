import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import os from 'node:os';

// Redirect the cache path (~/.config/wardayacode/update-check.json) to a temp dir.
// The spy must be in place before the module is imported.
const TEST_HOME = join(tmpdir(), 'wardayacode-update-test-' + Date.now());

vi.spyOn(os, 'homedir').mockReturnValue(TEST_HOME);

const { isNewerVersion, fetchLatestVersion, checkForUpdates } = await import(
  '../src/utils/updateCheck.js'
);

const CACHE_PATH = join(TEST_HOME, '.config', 'wardayacode', 'update-check.json');

beforeEach(async () => {
  await mkdir(join(TEST_HOME, '.config', 'wardayacode'), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_HOME, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('isNewerVersion', () => {
  it('returns true when latest major is greater', () => {
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
  });

  it('returns true when latest minor is greater', () => {
    expect(isNewerVersion('1.3.0', '1.2.9')).toBe(true);
  });

  it('returns true when latest patch is greater', () => {
    expect(isNewerVersion('1.2.4', '1.2.3')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false);
  });

  it('returns false when latest is older', () => {
    expect(isNewerVersion('1.2.3', '1.2.4')).toBe(false);
  });

  it('ignores a leading v on either side', () => {
    expect(isNewerVersion('v1.2.4', '1.2.3')).toBe(true);
    expect(isNewerVersion('1.2.4', 'v1.2.3')).toBe(true);
  });

  it('ignores pre-release and build suffixes', () => {
    expect(isNewerVersion('1.2.3-beta.1', '1.2.3')).toBe(false);
    expect(isNewerVersion('1.2.3+build5', '1.2.3')).toBe(false);
  });

  it('handles missing segments as zero', () => {
    expect(isNewerVersion('1.2', '1.2.0')).toBe(false);
    expect(isNewerVersion('1.3', '1.2.9')).toBe(true);
  });
});

describe('fetchLatestVersion', () => {
  it('returns the version string from a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '9.9.9' }),
      })
    );
    expect(await fetchLatestVersion()).toBe('9.9.9');
  });

  it('returns null on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchLatestVersion()).toBeNull();
  });

  it('returns null when version is missing from the payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect(await fetchLatestVersion()).toBeNull();
  });

  it('returns null when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await fetchLatestVersion()).toBeNull();
  });
});

describe('checkForUpdates', () => {
  it('fetches, reports an available update, and writes the cache', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: '2.0.0' }) })
    );

    const info = await checkForUpdates('1.0.0');
    expect(info).toEqual({ current: '1.0.0', latest: '2.0.0', updateAvailable: true });

    const cache = JSON.parse(await readFile(CACHE_PATH, 'utf-8')) as {
      lastCheck: number;
      latest: string;
    };
    expect(cache.latest).toBe('2.0.0');
    expect(typeof cache.lastCheck).toBe('number');
  });

  it('reports updateAvailable=false when already on the latest', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: '1.0.0' }) })
    );
    const info = await checkForUpdates('1.0.0');
    expect(info).toEqual({ current: '1.0.0', latest: '1.0.0', updateAvailable: false });
  });

  it('uses a fresh cache without hitting the network', async () => {
    await writeFile(
      CACHE_PATH,
      JSON.stringify({ lastCheck: Date.now(), latest: '3.0.0' }),
      'utf-8'
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const info = await checkForUpdates('1.0.0');
    expect(info).toEqual({ current: '1.0.0', latest: '3.0.0', updateAvailable: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refetches when the cache is stale', async () => {
    const twoDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 2;
    await writeFile(
      CACHE_PATH,
      JSON.stringify({ lastCheck: twoDaysAgo, latest: '1.0.0' }),
      'utf-8'
    );
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ version: '4.0.0' }) });
    vi.stubGlobal('fetch', fetchSpy);

    const info = await checkForUpdates('1.0.0');
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(info?.latest).toBe('4.0.0');
  });

  it('falls back to the stale cache value when the refetch fails', async () => {
    const twoDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 2;
    await writeFile(
      CACHE_PATH,
      JSON.stringify({ lastCheck: twoDaysAgo, latest: '5.0.0' }),
      'utf-8'
    );
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const info = await checkForUpdates('1.0.0');
    expect(info).toEqual({ current: '1.0.0', latest: '5.0.0', updateAvailable: true });
  });

  it('returns null when there is no cache and the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await checkForUpdates('1.0.0')).toBeNull();
  });
});
