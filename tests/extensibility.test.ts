import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { HookSystem } from '../src/extensibility/HookSystem.js';
import { SkillSystem } from '../src/extensibility/SkillSystem.js';
import { UndoManager } from '../src/tools/UndoManager.js';
import { ToolRegistry } from '../src/tools/ToolRegistry.js';
import { registerCoreTools } from '../src/tools/index.js';
import type { HookContext, HookResult, ToolDefinition, ToolResult } from '../src/types.js';
import { Tool } from '../src/tools/Tool.js';

// ── HookSystem ────────────────────────────────────────────────────────────────

describe('HookSystem', () => {
  it('register() and emit() calls the handler', async () => {
    const system = new HookSystem();
    const handler = vi.fn().mockResolvedValue({ proceed: true });
    system.register({ event: 'preToolUse', handler });

    const ctx: HookContext = { event: 'preToolUse', toolName: 'bash' };
    await system.emit('preToolUse', ctx);

    expect(handler).toHaveBeenCalledWith(ctx);
  });

  it('emit() does nothing when no handlers registered', async () => {
    const system = new HookSystem();
    await expect(system.emit('sessionStart', { event: 'sessionStart' })).resolves.toBeUndefined();
  });

  it('register() sorts handlers by priority (higher first)', async () => {
    const system = new HookSystem();
    const order: number[] = [];

    system.register({
      event: 'preToolUse',
      priority: 5,
      handler: async () => { order.push(5); return { proceed: true }; },
    });
    system.register({
      event: 'preToolUse',
      priority: 10,
      handler: async () => { order.push(10); return { proceed: true }; },
    });
    system.register({
      event: 'preToolUse',
      priority: 1,
      handler: async () => { order.push(1); return { proceed: true }; },
    });

    await system.emit('preToolUse', { event: 'preToolUse' });
    expect(order).toEqual([10, 5, 1]);
  });

  it('emit() catches handler errors without throwing', async () => {
    const system = new HookSystem();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    system.register({
      event: 'postToolUse',
      name: 'bad-hook',
      handler: async () => { throw new Error('boom'); },
    });

    await expect(system.emit('postToolUse', { event: 'postToolUse' })).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('emit() error log includes hook name when provided', async () => {
    const system = new HookSystem();
    const errSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      captured = args.join(' ');
    });
    let captured = '';

    system.register({
      event: 'stop',
      name: 'my-hook',
      handler: async () => { throw new Error('fail'); },
    });

    await system.emit('stop', { event: 'stop' });
    expect(captured).toContain('my-hook');
    errSpy.mockRestore();
  });

  it('getHooks() returns registered hooks for an event', () => {
    const system = new HookSystem();
    const handler = async (): Promise<HookResult> => ({ proceed: true });
    system.register({ event: 'sessionEnd', handler });

    const hooks = system.getHooks('sessionEnd');
    expect(hooks).toHaveLength(1);
    expect(hooks[0]!.event).toBe('sessionEnd');
  });

  it('getHooks() returns empty array for unregistered event', () => {
    const system = new HookSystem();
    expect(system.getHooks('notification')).toEqual([]);
  });

  it('unregister() removes a specific handler', async () => {
    const system = new HookSystem();
    const handler = vi.fn().mockResolvedValue({ proceed: true });
    system.register({ event: 'userPromptSubmit', handler });
    system.unregister('userPromptSubmit', handler);

    await system.emit('userPromptSubmit', { event: 'userPromptSubmit' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('unregister() is a no-op for an event with no handlers', () => {
    const system = new HookSystem();
    // Should not throw
    expect(() => system.unregister('preCompact', async () => ({ proceed: true }))).not.toThrow();
  });

  it('multiple handlers run in order for same event', async () => {
    const system = new HookSystem();
    const calls: string[] = [];
    system.register({ event: 'preToolUse', handler: async () => { calls.push('a'); return { proceed: true }; } });
    system.register({ event: 'preToolUse', handler: async () => { calls.push('b'); return { proceed: true }; } });

    await system.emit('preToolUse', { event: 'preToolUse' });
    expect(calls).toHaveLength(2);
  });
});

// ── SkillSystem ───────────────────────────────────────────────────────────────

describe('SkillSystem', () => {
  it('register() and get() retrieve a skill by name', () => {
    const system = new SkillSystem();
    const skill = { name: 'my-skill', description: 'does stuff', content: '# content' };
    system.register(skill);
    expect(system.get('my-skill')).toBe(skill);
  });

  it('get() returns undefined for unknown name', () => {
    const system = new SkillSystem();
    expect(system.get('nope')).toBeUndefined();
  });

  it('has() returns true for registered skill', () => {
    const system = new SkillSystem();
    system.register({ name: 'x', description: '', content: '' });
    expect(system.has('x')).toBe(true);
  });

  it('has() returns false for unregistered skill', () => {
    const system = new SkillSystem();
    expect(system.has('y')).toBe(false);
  });

  it('list() returns all registered skills', () => {
    const system = new SkillSystem();
    system.register({ name: 'a', description: '', content: '' });
    system.register({ name: 'b', description: '', content: '' });
    expect(system.list()).toHaveLength(2);
  });

  it('list() returns empty array when no skills registered', () => {
    const system = new SkillSystem();
    expect(system.list()).toEqual([]);
  });

  it('findByTrigger() returns skill when input matches a trigger', () => {
    const system = new SkillSystem();
    const skill = { name: 'deploy', description: '', content: '', triggers: ['deploy', 'release'] };
    system.register(skill);
    expect(system.findByTrigger('please deploy the app')).toBe(skill);
  });

  it('findByTrigger() is case-insensitive', () => {
    const system = new SkillSystem();
    const skill = { name: 'test', description: '', content: '', triggers: ['RunTests'] };
    system.register(skill);
    expect(system.findByTrigger('runtests now')).toBe(skill);
  });

  it('findByTrigger() returns undefined when no trigger matches', () => {
    const system = new SkillSystem();
    system.register({ name: 'x', description: '', content: '', triggers: ['alpha'] });
    expect(system.findByTrigger('totally unrelated')).toBeUndefined();
  });

  it('findByTrigger() returns undefined for skill with no triggers', () => {
    const system = new SkillSystem();
    system.register({ name: 'x', description: '', content: '' });
    expect(system.findByTrigger('anything')).toBeUndefined();
  });

  it('register() overwrites skill with same name', () => {
    const system = new SkillSystem();
    const a = { name: 'dup', description: 'first', content: '' };
    const b = { name: 'dup', description: 'second', content: '' };
    system.register(a);
    system.register(b);
    expect(system.list()).toHaveLength(1);
    expect(system.get('dup')).toBe(b);
  });
});

// ── buildSystemPrompt ─────────────────────────────────────────────────────────

// ── assertPathContained ───────────────────────────────────────────────────────

import { assertPathContained } from '../src/tools/pathSafety.js';

describe('assertPathContained()', () => {
  it('does not throw when path is inside rootDir', () => {
    expect(() => assertPathContained('/tmp/project/src/foo.ts', '/tmp/project')).not.toThrow();
  });

  it('does not throw when path equals rootDir', () => {
    expect(() => assertPathContained('/tmp/project', '/tmp/project')).not.toThrow();
  });

  it('throws when path escapes rootDir', () => {
    expect(() => assertPathContained('/tmp/other/secret.ts', '/tmp/project')).toThrow('Path escape detected');
  });

  it('throws on directory traversal attempt', () => {
    expect(() => assertPathContained('/tmp/project/../etc/passwd', '/tmp/project')).toThrow('Path escape detected');
  });
});

// ── buildSystemPrompt ─────────────────────────────────────────────────────────

vi.mock('../src/context/ProjectContext.js', () => ({
  gatherProjectContext: vi.fn().mockResolvedValue({ name: 'test-project', type: 'node' }),
  formatProjectContext: vi.fn().mockReturnValue('## Project: test-project'),
}));

const { buildSystemPrompt } = await import('../src/agent/systemPrompt.js');

describe('buildSystemPrompt()', () => {
  it('returns a string containing the cwd', async () => {
    const prompt = await buildSystemPrompt('/home/user/myproject');
    expect(prompt).toContain('/home/user/myproject');
  });

  it('includes the current platform', async () => {
    const prompt = await buildSystemPrompt('/tmp');
    expect(prompt).toContain(process.platform);
  });

  it('includes the Node.js version', async () => {
    const prompt = await buildSystemPrompt('/tmp');
    expect(prompt).toContain(process.version);
  });

  it('includes formatted project context from formatProjectContext', async () => {
    const prompt = await buildSystemPrompt('/tmp');
    expect(prompt).toContain('## Project: test-project');
  });

  it('contains tool usage guidance', async () => {
    const prompt = await buildSystemPrompt('/tmp');
    expect(prompt).toContain('read_file');
    expect(prompt).toContain('write_file');
    expect(prompt).toContain('edit_file');
  });

  it('emphatically pins the working directory to discourage path hallucination', async () => {
    const prompt = await buildSystemPrompt('/home/user/realproject');
    // The exact cwd must appear in the emphatic directive, not just the header.
    expect(prompt).toContain('EXACTLY: /home/user/realproject');
    // It must explicitly warn against inventing sandbox-style paths.
    expect(prompt).toContain('/workspace/');
    expect(prompt).toContain('list_files');
  });
});

// ── UndoManager (uncovered methods) ──────────────────────────────────────────

const UNDO_DIR = join(tmpdir(), 'wardayacode-undo-ext-' + Date.now());

beforeEach(async () => { await mkdir(UNDO_DIR, { recursive: true }); });
afterEach(async () => { await rm(UNDO_DIR, { recursive: true, force: true }); });

describe('UndoManager extra coverage', () => {
  it('getLastEntry() returns the most recent entry', async () => {
    const manager = new UndoManager();
    const fp = join(UNDO_DIR, 'a.txt');
    await writeFile(fp, 'hello');
    await manager.saveSnapshot(fp, 'edit_file');

    const entry = manager.getLastEntry();
    expect(entry).toBeDefined();
    expect(entry!.filePath).toBe(fp);
    expect(entry!.toolName).toBe('edit_file');
  });

  it('getLastEntry() returns undefined on empty stack', () => {
    const manager = new UndoManager();
    expect(manager.getLastEntry()).toBeUndefined();
  });

  it('clear() empties the stack', async () => {
    const manager = new UndoManager();
    const fp = join(UNDO_DIR, 'b.txt');
    await writeFile(fp, 'data');
    await manager.saveSnapshot(fp, 'write_file');
    expect(manager.getStackSize()).toBe(1);

    manager.clear();
    expect(manager.getStackSize()).toBe(0);
  });

  it('recordNewContent() handles deleted file gracefully', async () => {
    const manager = new UndoManager();
    const fp = join(UNDO_DIR, 'c.txt');
    await writeFile(fp, 'initial');
    await manager.saveSnapshot(fp, 'write_file');

    // Delete file between snapshot and recordNewContent
    await rm(fp);
    await expect(manager.recordNewContent(fp)).resolves.toBeUndefined();
    // Entry's newContent stays empty string
    expect(manager.getLastEntry()!.filePath).toBe(fp);
  });
});

// ── registerCoreTools with UndoManager ───────────────────────────────────────

describe('registerCoreTools()', () => {
  it('registers all core tools', () => {
    const registry = new ToolRegistry();
    registerCoreTools(registry);
    expect(registry.has('read_file')).toBe(true);
    expect(registry.has('write_file')).toBe(true);
    expect(registry.has('bash')).toBe(true);
  });

  it('wires UndoManager into write and edit tools when provided', () => {
    const registry = new ToolRegistry();
    const undoManager = new UndoManager();
    registerCoreTools(registry, undoManager);
    // Just verifying registration completes without error and tools are present
    expect(registry.has('write_file')).toBe(true);
    expect(registry.has('edit_file')).toBe(true);
  });
});

// ── Tool.checkPermission() ────────────────────────────────────────────────────

class ConcreteTestTool extends Tool {
  definition: ToolDefinition = {
    name: 'test-tool',
    description: 'test',
    inputSchema: { type: 'object', properties: {} },
    requiresPermission: false,
    concurrency: 'concurrent',
  };
  async execute(_input: Record<string, unknown>): Promise<ToolResult> {
    return { success: true };
  }
}

describe('Tool.checkPermission()', () => {
  it('returns true by default', async () => {
    const tool = new ConcreteTestTool();
    const result = await tool.checkPermission?.({});
    expect(result).toBe(true);
  });
});
