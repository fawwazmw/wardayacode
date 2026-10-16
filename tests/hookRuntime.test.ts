import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { HookSystem } from '../src/extensibility/HookSystem.js';
import { HookRuntime, HookTrustStore } from '../src/extensibility/hookLoader.js';

let tmpRoot: string;

// Point the user hooks dir at a non-existent path so the developer's real
// ~/.config/wardayacode/hooks can't leak into these tests.
const fakeHome = { value: '' };
vi.spyOn(os, 'homedir').mockImplementation(() => fakeHome.value);

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wardaya-hookruntime-'));
  fakeHome.value = path.join(tmpRoot, 'home');
  await fs.mkdir(path.join(tmpRoot, '.wardayacode', 'hooks'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

function makeRuntime(): { hookSystem: HookSystem; runtime: HookRuntime; trustPath: string } {
  const hookSystem = new HookSystem();
  const trustPath = path.join(tmpRoot, 'trust.json');
  const runtime = new HookRuntime(hookSystem, tmpRoot, new HookTrustStore(trustPath));
  return { hookSystem, runtime, trustPath };
}

describe('HookRuntime', () => {
  it('discovers project scripts as untrusted and does not register them', async () => {
    await fs.writeFile(path.join(tmpRoot, '.wardayacode', 'hooks', 'preToolUse.sh'), 'exit 0');
    const { hookSystem, runtime } = makeRuntime();

    const scripts = await runtime.activate();
    const project = scripts.find(s => s.path.startsWith(tmpRoot));
    expect(project).toBeDefined();
    expect(project!.project).toBe(true);
    expect(project!.trusted).toBe(false);

    expect(hookSystem.getHooks('preToolUse')).toHaveLength(0);
    expect(await runtime.status()).toContain('untrusted');
  });

  it('activates project hooks after trustProject', async () => {
    await fs.writeFile(
      path.join(tmpRoot, '.wardayacode', 'hooks', 'preToolUse.sh'),
      'echo "{\\"proceed\\":false,\\"reason\\":\\"no\\"}"',
    );
    const { hookSystem, runtime, trustPath } = makeRuntime();

    await runtime.activate();
    await runtime.trustProject();

    const store = new HookTrustStore(trustPath);
    expect(await store.isTrusted(tmpRoot)).toBe(true);
    expect(hookSystem.getHooks('preToolUse').length).toBeGreaterThan(0);
    expect(await runtime.status()).toContain('active');

    // The trusted hook now runs and blocks.
    const result = await hookSystem.emitWithResult('preToolUse', { event: 'preToolUse' });
    expect(result?.proceed).toBe(false);
    expect(result?.reason).toBe('no');
  });

  it('reports guidance when no hook scripts exist', async () => {
    const { runtime } = makeRuntime();
    await runtime.activate();
    expect(await runtime.status()).toContain('No hook scripts found');
  });
});
