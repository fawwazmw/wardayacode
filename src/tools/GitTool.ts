import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { Tool } from './Tool.js';
import { ToolDefinition, ToolResult } from '../types.js';

const SAFE_COMMANDS = new Set([
  'status', 'log', 'diff', 'show', 'branch', 'remote',
  'stash', 'fetch', 'pull', 'add', 'commit', 'push',
  'checkout', 'switch', 'merge', 'rebase', 'tag',
  'init', 'clone',
]);

const DESTRUCTIVE_SUBCOMMANDS = [
  /\breset\s+--hard\b/,
  /\bclean\s+-[a-zA-Z]*f/,
  /\bpush\s+.*--force\b/,
  /\bpush\s+-f\b/,
  /\bbranch\s+-[dD]\s/,
];

const GIT_TIMEOUT_MS = 120_000;

/**
 * Force git to be non-interactive so it can never block on a credential
 * prompt, pager, or editor (e.g. `git commit` with no -m).
 */
const GIT_ENV: Record<string, string> = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_PAGER: 'cat',
  GIT_EDITOR: 'true',
  GIT_OPTIONAL_LOCKS: '0',
};

/**
 * Split a git argument string into argv, honoring single/double quotes and
 * stripping the surrounding quotes. Without this, `commit -m "msg"` would pass
 * the literal quotes through to git as part of the message.
 */
export function tokenizeGitArgs(input: string): string[] {
  const tokens: string[] = [];
  const re = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const raw = match[1] ?? match[2] ?? match[3] ?? '';
    tokens.push(raw.replace(/\\(["'\\])/g, '$1'));
  }
  return tokens;
}

interface GitRunResult {
  stdout: string;
  stderr: string;
  code: number;
  timedOut: boolean;
}

function runGit(args: string[], cwd: string, timeoutMs: number = GIT_TIMEOUT_MS): Promise<GitRunResult> {
  return new Promise((res) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const proc = spawn('git', args, {
      cwd,
      env: { ...process.env, ...GIT_ENV },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = (result: GitRunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      res(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill('SIGKILL');
      } catch {
        // process may have already exited
      }
      finish({ stdout, stderr, code: 1, timedOut: true });
    }, timeoutMs);

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('error', (err) => finish({ stdout: '', stderr: err.message, code: 1, timedOut: false }));
    proc.on('close', (code) => finish({ stdout, stderr, code: code ?? 1, timedOut }));
  });
}

export class GitTool extends Tool {
  definition: ToolDefinition = {
    name: 'git',
    description:
      'Run a git command in the project repository. ' +
      'Supports: status, log, diff, show, branch, add, commit, push, pull, fetch, ' +
      'checkout, switch, merge, stash, remote, tag, init. ' +
      'Force push and hard reset are blocked. ' +
      'Always provide the full argument string, e.g. args: "commit -m \\"fix: typo\\"".',
    inputSchema: {
      type: 'object',
      properties: {
        args: {
          type: 'string',
          description:
            'Git arguments as a single string, e.g. "status", "log --oneline -10", ' +
            '"commit -m \\"feat: add login\\"", "push origin main".',
        },
        workdir: {
          type: 'string',
          description: 'Working directory. Defaults to current directory.',
        },
      },
      required: ['args'],
    },
    concurrency: 'exclusive',
    requiresPermission: true,
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    if (!this.validateInput(input)) {
      return { success: false, error: 'Missing required field: args' };
    }

    const argsStr = (input.args as string).trim();
    const workdir = input.workdir ? resolve(input.workdir as string) : process.cwd();

    const parts = tokenizeGitArgs(argsStr);
    const subcommand = parts[0]?.replace(/^-+/, '');

    if (!subcommand || !SAFE_COMMANDS.has(subcommand)) {
      return {
        success: false,
        error: `Unsupported git subcommand: "${subcommand}". Allowed: ${[...SAFE_COMMANDS].join(', ')}.`,
      };
    }

    for (const pattern of DESTRUCTIVE_SUBCOMMANDS) {
      if (pattern.test(argsStr)) {
        return {
          success: false,
          error: `Blocked: "${argsStr}" matches a destructive git pattern. Run it manually if intended.`,
        };
      }
    }

    const { stdout, stderr, code, timedOut } = await runGit(parts, workdir);

    const output = [stdout, stderr].filter(Boolean).join('\n').trim() || '(no output)';

    if (timedOut) {
      return {
        success: false,
        content: output,
        error: `git ${argsStr} timed out after ${GIT_TIMEOUT_MS}ms`,
        metadata: { args: argsStr, workdir, timedOut: true },
      };
    }

    return {
      success: code === 0,
      content: output,
      error: code !== 0 ? `git ${argsStr} exited with code ${code}` : undefined,
      metadata: { args: argsStr, workdir, exitCode: code },
    };
  }
}
