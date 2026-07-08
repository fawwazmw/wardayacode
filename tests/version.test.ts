import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fs.readFileSync to control what version.json returns
const mockReadFileSync = vi.fn();
vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
}));

// Clear module registry between tests so cachedVersion resets
beforeEach(() => {
  vi.resetModules();
  mockReadFileSync.mockReset();
});

describe('getCurrentVersion', () => {
  it('reads version from the local package.json', async () => {
    // When walking up from src/utils/, the first package.json found
    // with name "wardayacode" is at the repo root.
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.endsWith('package.json')) {
        return JSON.stringify({ name: 'wardayacode', version: '1.2.3' });
      }
      throw new Error('File not found');
    });

    const { getCurrentVersion } = await import('../src/utils/version.js');
    expect(getCurrentVersion()).toBe('1.2.3');
  });

  it('caches the result after first call', async () => {
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.endsWith('package.json')) {
        return JSON.stringify({ name: 'wardayacode', version: '0.5.0' });
      }
      throw new Error('File not found');
    });

    const { getCurrentVersion } = await import('../src/utils/version.js');
    expect(getCurrentVersion()).toBe('0.5.0');

    // Second call returns cached value, no additional fs reads
    mockReadFileSync.mockClear();
    expect(getCurrentVersion()).toBe('0.5.0');
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('returns 0.0.0 when package.json is not found', async () => {
    // Simulate no package.json in the walk-up
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const { getCurrentVersion } = await import('../src/utils/version.js');
    expect(getCurrentVersion()).toBe('0.0.0');
  });

  it('returns 0.0.0 when package.json has wrong name', async () => {
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.endsWith('package.json')) {
        return JSON.stringify({ name: 'some-other-package', version: '1.0.0' });
      }
      throw new Error('File not found');
    });

    const { getCurrentVersion } = await import('../src/utils/version.js');
    expect(getCurrentVersion()).toBe('0.0.0');
  });

  it('returns 0.0.0 when package.json has no version field', async () => {
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.endsWith('package.json')) {
        return JSON.stringify({ name: 'wardayacode' });
      }
      throw new Error('File not found');
    });

    const { getCurrentVersion } = await import('../src/utils/version.js');
    expect(getCurrentVersion()).toBe('0.0.0');
  });
});
