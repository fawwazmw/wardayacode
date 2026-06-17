import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitTool } from '../src/tools/GitTool.js';

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
  proc.on.mockImplementation((event: string, cb: (code: number) => void) => {
    if (event === 'close') cb(code);
  });

  (spawn as ReturnType<typeof vi.fn>).mockReturnValue(proc);
}

describe('GitTool', () => {
  let tool: GitTool;

  beforeEach(() => {
    tool = new GitTool();
    vi.clearAllMocks();
  });

  it('has correct definition', () => {
    expect(tool.definition.name).toBe('git');
    expect(tool.definition.requiresPermission).toBe(true);
    expect(tool.definition.inputSchema.required).toContain('args');
  });

  it('rejects missing args', async () => {
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required field');
  });

  it('rejects unsupported subcommands', async () => {
    const result = await tool.execute({ args: 'bisect start' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported git subcommand');
  });

  it('blocks force push', async () => {
    const result = await tool.execute({ args: 'push origin main --force' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked');
  });

  it('blocks push -f', async () => {
    const result = await tool.execute({ args: 'push -f origin main' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked');
  });

  it('rejects git reset (not in allowed subcommands)', async () => {
    const result = await tool.execute({ args: 'reset --hard HEAD~1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported git subcommand');
  });

  it('rejects branch -D (not in allowed subcommands)', async () => {
    const result = await tool.execute({ args: 'branch -D my-branch' });
    expect(result.success).toBe(false);
  });

  it('rejects git clean (not in allowed subcommands)', async () => {
    const result = await tool.execute({ args: 'clean -fd' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported git subcommand');
  });

  it('runs git status successfully', async () => {
    mockGitProcess('On branch main\nnothing to commit', '', 0);
    const result = await tool.execute({ args: 'status' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('On branch main');
  });

  it('runs git log with flags', async () => {
    mockGitProcess('abc1234 feat: add login\ndef5678 fix: typo', '', 0);
    const result = await tool.execute({ args: 'log --oneline -10' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('feat: add login');
  });

  it('runs git commit with quoted message', async () => {
    mockGitProcess('[main abc1234] feat: add login\n 1 file changed', '', 0);
    const result = await tool.execute({ args: 'commit -m "feat: add login"' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('feat: add login');
  });

  it('returns error on non-zero exit', async () => {
    mockGitProcess('', 'fatal: not a git repository', 128);
    const result = await tool.execute({ args: 'status' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('exited with code 128');
    expect(result.content).toContain('fatal: not a git repository');
  });

  it('includes stderr in output even on success', async () => {
    mockGitProcess('Already up to date.', 'hint: use --rebase', 0);
    const result = await tool.execute({ args: 'pull' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('hint: use --rebase');
  });

  it('returns (no output) when stdout and stderr are empty', async () => {
    mockGitProcess('', '', 0);
    const result = await tool.execute({ args: 'fetch' });
    expect(result.success).toBe(true);
    expect(result.content).toBe('(no output)');
  });
});
