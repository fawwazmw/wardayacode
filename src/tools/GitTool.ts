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

function runGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((res) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn('git', args, {
      cwd,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('error', (err) => res({ stdout: '', stderr: err.message, code: 1 }));
    proc.on('close', (code) => res({ stdout, stderr, code: code ?? 1 }));
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

    const parts = argsStr.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
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

    const { stdout, stderr, code } = await runGit(parts, workdir);

    const output = [stdout, stderr].filter(Boolean).join('\n').trim() || '(no output)';

    return {
      success: code === 0,
      content: output,
      error: code !== 0 ? `git ${argsStr} exited with code ${code}` : undefined,
      metadata: { args: argsStr, workdir, exitCode: code },
    };
  }
}
