import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Checkpoint } from '../src/tools/Checkpoint.js';

vi.mock('node:child_process', () => {
  const mockSpawn = vi.fn();
  return { spawn: mockSpawn };
});

import { spawn } from 'node:child_process';

function mockGitProcess(stdout: string, stderr: string, code: number) {
  const stdoutEmitter = { on: vi.fn() };
  const stderrEmitter = { on: vi.fn() };
  const proc = {
    stdout: stdoutEmitter,
    stderr: stderrEmitter,
    on: vi.fn(),
  };

  stdoutEmitter.on.mockImplementation((event: string, cb: (d: Buffer) => void) => {
    if (event === 'data' && stdout) cb(Buffer.from(stdout));
  });
  stderrEmitter.on.mockImplementation((event: string, cb: (d: Buffer) => void) => {
    if (event === 'data' && stderr) cb(Buffer.from(stderr));
  });
  proc.on.mockImplementation((event: string, cb: (code: number | null) => void) => {
    if (event === 'close') cb(code);
  });

  (spawn as ReturnType<typeof vi.fn>).mockReturnValue(proc);
}

function mockGitError(message: string) {
  const stdoutEmitter = { on: vi.fn() };
  const stderrEmitter = { on: vi.fn() };
  const proc = {
    stdout: stdoutEmitter,
    stderr: stderrEmitter,
    on: vi.fn(),
  };

  stdoutEmitter.on.mockImplementation(() => {});
  stderrEmitter.on.mockImplementation(() => {});
  proc.on.mockImplementation((event: string, cb: (arg: unknown) => void) => {
    if (event === 'error') cb(new Error(message));
  });

  (spawn as ReturnType<typeof vi.fn>).mockReturnValue(proc);
}

describe('Checkpoint', () => {
  let checkpoint: Checkpoint;

  beforeEach(() => {
    checkpoint = new Checkpoint('/tmp/test-project');
    vi.clearAllMocks();
  });

  describe('isGitRepo()', () => {
    it('returns true when git exits 0', async () => {
      mockGitProcess('true', '', 0);
      expect(await checkpoint.isGitRepo()).toBe(true);
    });

    it('returns false when git exits non-zero', async () => {
      mockGitProcess('', 'not a git repo', 128);
      expect(await checkpoint.isGitRepo()).toBe(false);
    });

    it('returns false when spawn errors', async () => {
      mockGitError('git not found');
      expect(await checkpoint.isGitRepo()).toBe(false);
    });
  });

  describe('createCheckpoint()', () => {
    it('returns false when not a git repo', async () => {
      mockGitProcess('', 'not a git repo', 128);
      expect(await checkpoint.createCheckpoint('test')).toBe(false);
    });

    it('returns false when no uncommitted changes', async () => {
      // First call: rev-parse (isGitRepo) → success
      // Second call: git status --porcelain → empty output (no changes)
      (spawn as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(makeProcSuccess('true'))
        .mockReturnValueOnce(makeProcSuccess(''));

      expect(await checkpoint.createCheckpoint('test')).toBe(false);
    });

    it('returns true when changes exist and stash succeeds', async () => {
      (spawn as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(makeProcSuccess('true'))        // isGitRepo
        .mockReturnValueOnce(makeProcSuccess(' M src/a.ts')) // status --porcelain
        .mockReturnValueOnce(makeProcSuccess(''));            // stash push

      expect(await checkpoint.createCheckpoint('my message')).toBe(true);
    });
  });

  describe('rollback()', () => {
    it('returns false when no stash was created', async () => {
      expect(await checkpoint.rollback()).toBe(false);
    });

    it('returns true after createCheckpoint + rollback', async () => {
      (spawn as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(makeProcSuccess('true'))        // isGitRepo
        .mockReturnValueOnce(makeProcSuccess(' M src/a.ts')) // status
        .mockReturnValueOnce(makeProcSuccess(''))            // stash push
        .mockReturnValueOnce(makeProcSuccess(''));            // stash pop

      await checkpoint.createCheckpoint('test');
      expect(await checkpoint.rollback()).toBe(true);
    });
  });

  describe('hasUncommittedChanges()', () => {
    it('returns true when status has output', async () => {
      mockGitProcess(' M src/foo.ts', '', 0);
      expect(await checkpoint.hasUncommittedChanges()).toBe(true);
    });

    it('returns false when status is empty', async () => {
      mockGitProcess('', '', 0);
      expect(await checkpoint.hasUncommittedChanges()).toBe(false);
    });

    it('returns false on git error', async () => {
      mockGitError('git failure');
      expect(await checkpoint.hasUncommittedChanges()).toBe(false);
    });
  });

  describe('getDiff()', () => {
    it('returns git diff --stat output', async () => {
      mockGitProcess(' src/foo.ts | 2 +-\n 1 file changed', '', 0);
      const diff = await checkpoint.getDiff();
      expect(diff).toContain('src/foo.ts');
    });

    it('returns empty string on git error', async () => {
      mockGitError('git diff failed');
      const diff = await checkpoint.getDiff();
      expect(diff).toBe('');
    });
  });
});

// Helper to build a successful process mock inline
function makeProcSuccess(stdout: string) {
  const stdoutEmitter = { on: vi.fn() };
  const stderrEmitter = { on: vi.fn() };
  const proc = {
    stdout: stdoutEmitter,
    stderr: stderrEmitter,
    on: vi.fn(),
  };

  stdoutEmitter.on.mockImplementation((event: string, cb: (d: Buffer) => void) => {
    if (event === 'data' && stdout) cb(Buffer.from(stdout));
  });
  stderrEmitter.on.mockImplementation(() => {});
  proc.on.mockImplementation((event: string, cb: (code: number) => void) => {
    if (event === 'close') cb(0);
  });

  return proc;
}
