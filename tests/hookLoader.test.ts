import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  discoverHookScripts,
  runHookScript,
  HookTrustStore,
  type HookScript,
} from '../src/extensibility/hookLoader.js';

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wardaya-hooks-'));
  await fs.mkdir(path.join(tmpRoot, '.wardayacode', 'hooks'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function writeHook(name: string, body: string): Promise<string> {
  const p = path.join(tmpRoot, '.wardayacode', 'hooks', name);
  await fs.writeFile(p, body, { mode: 0o755 });
  return p;
}

describe('discoverHookScripts', () => {
  it('finds known event scripts and ignores unknown ones', async () => {
    await writeHook('preToolUse.sh', 'exit 0');
    await writeHook('bogusEvent.sh', 'exit 0');
    await writeHook('notes.txt', 'ignored');

    const scripts = await discoverHookScripts(tmpRoot, false);
    const names = scripts.map(s => path.basename(s.path));
    expect(names).toContain('preToolUse.sh');
    expect(names).not.toContain('bogusEvent.sh');
    expect(names).not.toContain('notes.txt');
  });

  it('marks project scripts trusted only when the project is trusted', async () => {
    await writeHook('preToolUse.sh', 'exit 0');

    const untrusted = await discoverHookScripts(tmpRoot, false);
    const pre = untrusted.find(s => path.basename(s.path) === 'preToolUse.sh');
    expect(pre!.trusted).toBe(false);
    expect(pre!.project).toBe(true);

    const trusted = await discoverHookScripts(tmpRoot, true);
    const preTrusted = trusted.find(s => path.basename(s.path) === 'preToolUse.sh');
    expect(preTrusted!.trusted).toBe(true);
  });
});

describe('runHookScript', () => {
  const script = (p: string): HookScript => ({
    event: 'preToolUse',
    path: p,
    trusted: true,
    project: true,
  });

  it('proceeds on exit 0 with no output', async () => {
    const p = await writeHook('preToolUse.sh', 'exit 0');
    const result = await runHookScript(script(p), { event: 'preToolUse' });
    expect(result?.proceed).toBe(true);
  });

  it('blocks on exit 2 and uses stderr as the reason', async () => {
    const p = await writeHook('preToolUse.sh', 'echo "blocked reason" >&2; exit 2');
    const result = await runHookScript(script(p), { event: 'preToolUse' });
    expect(result?.proceed).toBe(false);
    expect(result?.reason).toContain('blocked reason');
  });

  it('honours JSON output with proceed:false and reason', async () => {
    const p = await writeHook('preToolUse.sh', 'echo \'{"proceed":false,"reason":"policy"}\'');
    const result = await runHookScript(script(p), { event: 'preToolUse' });
    expect(result?.proceed).toBe(false);
    expect(result?.reason).toBe('policy');
  });

  it('returns modifiedInput from JSON output', async () => {
    const p = await writeHook('preToolUse.sh', 'echo \'{"proceed":true,"modifiedInput":{"path":"/tmp/x"}}\'');
    const result = await runHookScript(script(p), { event: 'preToolUse' });
    expect(result?.modifiedInput).toEqual({ path: '/tmp/x' });
  });

  it('does not block on other non-zero exits', async () => {
    const p = await writeHook('preToolUse.sh', 'exit 1');
    const result = await runHookScript(script(p), { event: 'preToolUse' });
    expect(result?.proceed).toBe(true);
  });
});

describe('HookTrustStore', () => {
  it('persists trusted project roots', async () => {
    const storePath = path.join(tmpRoot, 'trust.json');
    const store = new HookTrustStore(storePath);

    expect(await store.isTrusted('/some/project')).toBe(false);
    await store.trust('/some/project');
    expect(await store.isTrusted('/some/project')).toBe(true);
    expect(await store.isTrusted('/other/project')).toBe(false);
  });
});
