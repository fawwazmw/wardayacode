import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import treeKill from 'tree-kill';
import { Tool } from './Tool.js';
import { ToolDefinition, ToolResult } from '../types.js';

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f\b/,  // rm -rf variants
  /\brm\s+-[a-zA-Z]*f[a-zA-Z]*r\b/,
  /\bdd\b.*\bof=/,
  /\bmkfs\b/,
  /\bformat\b/,
  />\s*\/dev\/(sd|hd|nvme)/,
  /\bsudo\s+rm\b/,
  /\bchmod\s+-R\s+777\b/,
];

function isDestructive(command: string): string | null {
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(command)) {
      return pattern.toString();
    }
  }
  return null;
}

export class BashTool extends Tool {
  definition: ToolDefinition = {
    name: 'bash',
    description:
      'Execute a shell command in a child process. ' +
      'Captures stdout and stderr. Supports timeout and working directory options.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        workdir: {
          type: 'string',
          description: 'Working directory for the command. Defaults to current directory.',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds. Defaults to 120000 (2 minutes).',
        },
      },
      required: ['command'],
    },
    concurrency: 'exclusive',
    requiresPermission: true,
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    if (!this.validateInput(input)) {
      return { success: false, error: 'Missing required field: command' };
    }

    const command = input.command as string;
    const workdir = input.workdir ? resolve(input.workdir as string) : undefined;
    const rawTimeout = (input.timeout as number) || DEFAULT_TIMEOUT_MS;
    const timeout = Math.max(100, Math.min(MAX_TIMEOUT_MS, rawTimeout));

    const destructiveMatch = isDestructive(command);
    if (destructiveMatch) {
      process.stderr.write(`[wardayacode] WARNING: Potentially destructive command blocked: ${command}\n`);
      return {
        success: false,
        error: `Blocked: command matches a destructive pattern. If you intend to run this, adjust the permission mode or run it manually.`,
        metadata: { command, workdir },
      };
    }

    process.stderr.write(`[wardayacode] bash: ${command}\n`);

    return new Promise<ToolResult>((resolvePromise) => {
      let stdout = '';
      let stderr = '';
      let killed = false;
      let timedOut = false;

      const proc = spawn('bash', ['-c', command], {
        cwd: workdir,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        timedOut = true;
        killed = true;
        if (proc.pid) {
          treeKill(proc.pid, 'SIGKILL', () => {});
        }
      }, timeout);

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        resolvePromise({
          success: false,
          error: `Failed to execute command: ${error.message}`,
          metadata: { command, workdir },
        });
      });

      proc.on('close', (code) => {
        clearTimeout(timer);

        if (timedOut) {
          resolvePromise({
            success: false,
            error: `Command timed out after ${timeout}ms`,
            content: stdout + (stderr ? `\n--- stderr ---\n${stderr}` : ''),
            metadata: { command, workdir, exitCode: code, timedOut: true, killed },
          });
          return;
        }

        const output = stdout + (stderr ? `\n--- stderr ---\n${stderr}` : '');
        const exitCode = code ?? 1;

        resolvePromise({
          success: exitCode === 0,
          content: output || '(no output)',
          error: exitCode !== 0 ? `Command exited with code ${exitCode}` : undefined,
          metadata: { command, workdir, exitCode },
        });
      });
    });
  }
}
