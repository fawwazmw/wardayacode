import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => {
  const mockSpawn = vi.fn();
  return { spawn: mockSpawn };
});

import { spawn } from 'node:child_process';
import { runSelfUpdate } from '../src/utils/selfUpdate.js';

// Builds a child-process mock whose 'close' fires with the given exit code.
function mockProcClose(code: number) {
  const proc = { on: vi.fn() };
  proc.on.mockImplementation((event: string, cb: (arg: number) => void) => {
    if (event === 'close') cb(code);
  });
  (spawn as ReturnType<typeof vi.fn>).mockReturnValue(proc);
}

// Builds a child-process mock that emits an 'error' (e.g. npm not found).
function mockProcError(message: string) {
  const proc = { on: vi.fn() };
  proc.on.mockImplementation((event: string, cb: (arg: unknown) => void) => {
    if (event === 'error') cb(new Error(message));
  });
  (spawn as ReturnType<typeof vi.fn>).mockReturnValue(proc);
}

describe('runSelfUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes npm install -g wardayacode@latest with inherited stdio', async () => {
    mockProcClose(0);
    await runSelfUpdate();
    expect(spawn).toHaveBeenCalledWith(
      'npm',
      ['install', '-g', 'wardayacode@latest'],
      { stdio: 'inherit' }
    );
  });

  it('resolves true when npm exits 0', async () => {
    mockProcClose(0);
    expect(await runSelfUpdate()).toBe(true);
  });

  it('resolves false when npm exits non-zero', async () => {
    mockProcClose(1);
    expect(await runSelfUpdate()).toBe(false);
  });

  it('resolves false when spawn errors', async () => {
    mockProcError('npm not found');
    expect(await runSelfUpdate()).toBe(false);
  });
});
