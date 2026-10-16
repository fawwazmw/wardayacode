import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ToolRegistry } from '../src/tools/ToolRegistry.js';
import { HookSystem } from '../src/extensibility/HookSystem.js';
import {
  PluginRuntime,
  PluginTrustStore,
  discoverPlugins,
} from '../src/extensibility/pluginLoader.js';

let tmpRoot: string;

const fakeHome = { value: '' };
vi.spyOn(os, 'homedir').mockImplementation(() => fakeHome.value);

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wardaya-plugins-'));
  fakeHome.value = path.join(tmpRoot, 'home');
  await fs.mkdir(path.join(tmpRoot, '.wardayacode', 'plugins'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function writePlugin(name: string, body: string): Promise<void> {
  await fs.writeFile(path.join(tmpRoot, '.wardayacode', 'plugins', name), body);
}

const ECHO_PLUGIN = `
export default function (api) {
  api.registerTool({
    name: 'echo_plugin',
    description: 'Echo text',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    execute: (input) => ({ success: true, content: 'echo:' + input.text }),
  });
}
`;

describe('discoverPlugins', () => {
  it('finds .js/.mjs files and marks project plugins untrusted by default', async () => {
    await writePlugin('demo.mjs', 'export default () => {}');
    await writePlugin('other.mjs', 'export default () => {}');
    await writePlugin('notes.txt', 'ignored');

    const plugins = await discoverPlugins(tmpRoot, false);
    expect(plugins.map(p => p.name).sort()).toEqual(['demo', 'other']);
    expect(plugins.every(p => p.project && !p.trusted)).toBe(true);

    const trusted = await discoverPlugins(tmpRoot, true);
    expect(trusted.every(p => p.trusted)).toBe(true);
  });
});

describe('PluginRuntime', () => {
  it('does not load untrusted project plugins', async () => {
    await writePlugin('demo.mjs', ECHO_PLUGIN);
    const registry = new ToolRegistry();
    const runtime = new PluginRuntime(registry, new HookSystem(), tmpRoot, new PluginTrustStore(path.join(tmpRoot, 'trust.json')));

    await runtime.activate();
    expect(runtime.hasActivePlugins()).toBe(false);
    expect(registry.has('echo_plugin')).toBe(false);
    expect(await runtime.status()).toContain('untrusted');
  });

  it('registers tools from a trusted project plugin', async () => {
    await writePlugin('demo.mjs', ECHO_PLUGIN);
    const registry = new ToolRegistry();
    const trustPath = path.join(tmpRoot, 'trust.json');
    const runtime = new PluginRuntime(registry, new HookSystem(), tmpRoot, new PluginTrustStore(trustPath));

    await runtime.trustProject();

    expect(await new PluginTrustStore(trustPath).isTrusted(tmpRoot)).toBe(true);
    expect(runtime.getLoadedNames()).toContain('demo');
    expect(registry.has('echo_plugin')).toBe(true);

    const result = await registry.execute('echo_plugin', { text: 'hi' });
    expect(result.success).toBe(true);
    expect(result.content).toBe('echo:hi');
    expect(await runtime.status()).toContain('active');
  });

  it('registers hooks from a plugin', async () => {
    await writePlugin(
      'guard.mjs',
      `export const hooks = [{ event: 'preToolUse', handler: () => ({ proceed: false, reason: 'nope' }) }];`,
    );
    const hooks = new HookSystem();
    const runtime = new PluginRuntime(new ToolRegistry(), hooks, tmpRoot, new PluginTrustStore(path.join(tmpRoot, 'trust.json')));

    await runtime.trustProject();

    const result = await hooks.emitWithResult('preToolUse', { event: 'preToolUse' });
    expect(result?.proceed).toBe(false);
    expect(result?.reason).toBe('nope');
  });

  it('does not duplicate plugin hooks on repeated activate (reload)', async () => {
    await writePlugin(
      'guard.mjs',
      `export const hooks = [{ event: 'preToolUse', handler: () => ({ proceed: true }) }];`,
    );
    const hooks = new HookSystem();
    const runtime = new PluginRuntime(new ToolRegistry(), hooks, tmpRoot, new PluginTrustStore(path.join(tmpRoot, 'trust.json')));

    await runtime.trustProject(); // activates once
    await runtime.activate(); // reload

    expect(hooks.getHooks('preToolUse')).toHaveLength(1);
  });

  it('reports guidance when no plugins exist', async () => {
    const runtime = new PluginRuntime(new ToolRegistry(), new HookSystem(), tmpRoot, new PluginTrustStore(path.join(tmpRoot, 'trust.json')));
    await runtime.activate();
    expect(await runtime.status()).toContain('No plugins found');
  });
});
