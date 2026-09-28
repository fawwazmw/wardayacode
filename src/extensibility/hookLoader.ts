import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'node:child_process';
import type { HookEvent, HookContext, HookResult } from '../types.js';
import type { HookSystem } from './HookSystem.js';

const HOOK_EVENTS: HookEvent[] = [
  'preToolUse',
  'postToolUse',
  'sessionStart',
  'sessionEnd',
  'userPromptSubmit',
  'preCompact',
  'stop',
  'notification',
];

/** Default per-hook execution timeout. */
const HOOK_TIMEOUT_MS = 10_000;
/** Max characters of a hook's reason surfaced to the agent. */
const MAX_REASON_CHARS = 1_000;

export interface HookScript {
  event: HookEvent;
  /** Absolute path to the script. */
  path: string;
  /** Whether the script is allowed to run (user hooks, or trusted project). */
  trusted: boolean;
  /** True when the script lives in the project directory (untrusted by default). */
  project: boolean;
}

/**
 * Hook directories with their trust stance. User-level hooks are always
 * trusted; project-level hooks are untrusted because they can arrive with a
 * cloned repository.
 */
function getHookDirs(projectRoot: string): { dir: string; project: boolean }[] {
  return [
    { dir: path.join(projectRoot, '.wardayacode', 'hooks'), project: true },
    { dir: path.join(os.homedir(), '.config', 'wardayacode', 'hooks'), project: false },
  ];
}

/**
 * Discover hook scripts named `<event>.sh` or `<event>.js` in the project and
 * user hook directories.
 */
export async function discoverHookScripts(
  projectRoot: string,
  projectTrusted: boolean,
): Promise<HookScript[]> {
  const scripts: HookScript[] = [];

  for (const { dir, project } of getHookDirs(projectRoot)) {
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      const match = file.match(/^([A-Za-z]+)\.(sh|js)$/);
      if (!match) continue;
      const event = match[1]!;
      if (!HOOK_EVENTS.includes(event as HookEvent)) continue;

      scripts.push({
        event: event as HookEvent,
        path: path.join(dir, file),
        trusted: project ? projectTrusted : true,
        project,
      });
    }
  }

  return scripts;
}

function normalizeHookOutput(raw: string): HookResult | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      const result: HookResult = { proceed: parsed.proceed !== false };
      if (typeof parsed.reason === 'string') result.reason = parsed.reason;
      if (parsed.modifiedInput && typeof parsed.modifiedInput === 'object') {
        result.modifiedInput = parsed.modifiedInput as Record<string, unknown>;
      }
      return result;
    }
  } catch {
    // Not JSON — treated as informational output below.
  }
  return undefined;
}

/**
 * Execute a hook script. The hook context is written to stdin as JSON.
 *
 * Contract:
 * - exit 0: proceed (stdout may be JSON `{proceed, reason, modifiedInput}`)
 * - exit 2: block; stderr (or stdout) becomes the reason
 * - any other exit / spawn error / timeout: treated as a non-blocking failure
 */
export async function runHookScript(
  script: HookScript,
  context: HookContext,
  timeoutMs: number = HOOK_TIMEOUT_MS,
): Promise<HookResult | undefined> {
  const runner = script.path.endsWith('.js') ? process.execPath : 'bash';

  return new Promise<HookResult | undefined>(resolve => {
    let settled = false;
    const finish = (result: HookResult | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    let child;
    try {
      child = spawn(runner, [script.path], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      finish(undefined);
      return;
    }

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // process may have already exited
      }
      finish(undefined);
    }, timeoutMs);

    child.stdout?.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr?.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', () => finish(undefined));
    child.on('close', code => {
      const parsed = normalizeHookOutput(stdout);

      if (code === 2 || parsed?.proceed === false) {
        const reason = (parsed?.reason ?? stderr.trim() ?? stdout.trim() ?? 'Blocked by hook').slice(
          0,
          MAX_REASON_CHARS,
        );
        finish({ proceed: false, reason: reason || 'Blocked by hook' });
        return;
      }

      finish(parsed ?? { proceed: true });
    });

    try {
      child.stdin?.end(JSON.stringify(context));
    } catch {
      finish(undefined);
    }
  });
}

/** Persists trusted project roots in the user's config directory. */
export class HookTrustStore {
  constructor(private readonly filePath: string) {}

  private async read(): Promise<string[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as { projects?: unknown };
      return Array.isArray(parsed.projects) ? (parsed.projects as string[]) : [];
    } catch {
      return [];
    }
  }

  async isTrusted(projectRoot: string): Promise<boolean> {
    return (await this.read()).includes(projectRoot);
  }

  async trust(projectRoot: string): Promise<void> {
    const projects = await this.read();
    if (!projects.includes(projectRoot)) {
      projects.push(projectRoot);
    }
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify({ projects }, null, 2), 'utf-8');
  }
}

export function getUserHookTrustPath(): string {
  return path.join(os.homedir(), '.config', 'wardayacode', 'hooks-trust.json');
}

/**
 * Loads hook scripts into a HookSystem and exposes status/trust operations.
 * Reloading clears previously registered hooks first.
 */
export class HookRuntime {
  private scripts: HookScript[] = [];

  constructor(
    private readonly hookSystem: HookSystem,
    private readonly projectRoot: string,
    private readonly trustStore: HookTrustStore = new HookTrustStore(getUserHookTrustPath()),
  ) {}

  /** Discover scripts and register the trusted ones. Returns all discovered scripts. */
  async activate(): Promise<HookScript[]> {
    const projectTrusted = await this.trustStore.isTrusted(this.projectRoot);
    this.scripts = await discoverHookScripts(this.projectRoot, projectTrusted);

    this.hookSystem.clear();
    for (const script of this.scripts) {
      if (!script.trusted) continue;
      this.hookSystem.register({
        event: script.event,
        name: script.path,
        handler: async (context: HookContext) => (await runHookScript(script, context)) ?? { proceed: true },
      });
    }

    return this.scripts;
  }

  getScripts(): HookScript[] {
    return [...this.scripts];
  }

  hasActiveHooks(): boolean {
    return this.scripts.some(s => s.trusted);
  }

  async trustProject(): Promise<void> {
    await this.trustStore.trust(this.projectRoot);
    await this.activate();
  }

  async status(): Promise<string> {
    const projectTrusted = await this.trustStore.isTrusted(this.projectRoot);
    const scripts = this.scripts.length ? this.scripts : await discoverHookScripts(this.projectRoot, projectTrusted);

    if (scripts.length === 0) {
      return 'No hook scripts found.\nAdd <event>.sh or <event>.js to .wardayacode/hooks/ or ~/.config/wardayacode/hooks/.\nEvents: preToolUse, postToolUse, sessionStart, sessionEnd, userPromptSubmit, preCompact, stop, notification.';
    }

    const lines = scripts.map(s => {
      const state = s.trusted ? 'active' : 'untrusted';
      const scope = s.project ? 'project' : 'user';
      return `  ${s.event.padEnd(16)} ${state.padEnd(10)} ${scope.padEnd(8)} ${path.basename(s.path)}`;
    });

    const untrusted = scripts.filter(s => !s.trusted).length;
    const footer = untrusted > 0
      ? `\n\n${untrusted} project hook(s) are not trusted and will not run.\nRun /hooks trust to allow project hooks for ${this.projectRoot}.`
      : '';

    return `Hooks:\n${lines.join('\n')}${footer}`;
  }
}
