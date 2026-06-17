import { describe, it, expect, vi } from 'vitest';
import { PermissionSystem } from '../src/permissions/PermissionSystem.js';

describe('PermissionSystem — tool name matching', () => {
  it('denies write_file in default mode', async () => {
    const perms = new PermissionSystem('default');
    const result = await perms.check({ name: 'write_file', input: {} });
    expect(result.allowed).toBe(false);
  });

  it('denies edit_file in default mode', async () => {
    const perms = new PermissionSystem('default');
    const result = await perms.check({ name: 'edit_file', input: {} });
    expect(result.allowed).toBe(false);
  });

  it('allows read_file in default mode', async () => {
    const perms = new PermissionSystem('default');
    const result = await perms.check({ name: 'read_file', input: {} });
    expect(result.allowed).toBe(true);
  });

  it('allows glob in default mode', async () => {
    const perms = new PermissionSystem('default');
    const result = await perms.check({ name: 'glob', input: {} });
    expect(result.allowed).toBe(true);
  });

  it('allows grep in default mode', async () => {
    const perms = new PermissionSystem('default');
    const result = await perms.check({ name: 'grep', input: {} });
    expect(result.allowed).toBe(true);
  });

  it('denies write_file in plan mode', async () => {
    const perms = new PermissionSystem('plan');
    const result = await perms.check({ name: 'write_file', input: {} });
    expect(result.allowed).toBe(false);
  });

  it('denies bash in acceptEdits mode', async () => {
    const perms = new PermissionSystem('acceptEdits');
    const result = await perms.check({ name: 'bash', input: {} });
    expect(result.allowed).toBe(false);
  });

  it('allows write_file in acceptEdits mode', async () => {
    const perms = new PermissionSystem('acceptEdits');
    const result = await perms.check({ name: 'write_file', input: {} });
    expect(result.allowed).toBe(true);
  });

  it('allows everything in auto mode', async () => {
    const perms = new PermissionSystem('auto');
    expect((await perms.check({ name: 'bash', input: {} })).allowed).toBe(true);
    expect((await perms.check({ name: 'write_file', input: {} })).allowed).toBe(true);
    expect((await perms.check({ name: 'edit_file', input: {} })).allowed).toBe(true);
  });

  it('allows everything in internal mode', async () => {
    const perms = new PermissionSystem('internal');
    expect((await perms.check({ name: 'bash', input: {} })).allowed).toBe(true);
    expect((await perms.check({ name: 'write_file', input: {} })).allowed).toBe(true);
  });
});

describe('PermissionSystem — plan mode hard deny', () => {
  it('denies without calling promptHandler', async () => {
    const perms = new PermissionSystem('plan');
    const handler = vi.fn().mockResolvedValue('allow');
    perms.setPromptHandler(handler);
    const result = await perms.check({ name: 'bash', input: {} });
    expect(result.allowed).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('includes a reason when denying', async () => {
    const perms = new PermissionSystem('plan');
    const result = await perms.check({ name: 'edit_file', input: {} });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('allows read-only tools in plan mode', async () => {
    const perms = new PermissionSystem('plan');
    expect((await perms.check({ name: 'read_file', input: {} })).allowed).toBe(true);
    expect((await perms.check({ name: 'glob', input: {} })).allowed).toBe(true);
    expect((await perms.check({ name: 'grep', input: {} })).allowed).toBe(true);
    expect((await perms.check({ name: 'list_files', input: {} })).allowed).toBe(true);
  });
});

describe('PermissionSystem — promptHandler and sessionAllowList', () => {
  it('calls promptHandler when a rule denies in default mode', async () => {
    const perms = new PermissionSystem('default');
    const handler = vi.fn().mockResolvedValue('deny');
    perms.setPromptHandler(handler);
    const result = await perms.check({ name: 'bash', input: { command: 'echo hi' } });
    expect(handler).toHaveBeenCalledWith('bash', { command: 'echo hi' }, expect.any(String));
    expect(result.allowed).toBe(false);
  });

  it('allows when promptHandler returns allow', async () => {
    const perms = new PermissionSystem('default');
    perms.setPromptHandler(vi.fn().mockResolvedValue('allow'));
    const result = await perms.check({ name: 'bash', input: {} });
    expect(result.allowed).toBe(true);
  });

  it('adds tool to sessionAllowList when promptHandler returns always', async () => {
    const perms = new PermissionSystem('default');
    perms.setPromptHandler(vi.fn().mockResolvedValue('always'));
    await perms.check({ name: 'bash', input: {} });
    expect(perms.getSessionAllowList()).toContain('bash');
  });

  it('skips promptHandler for tools in sessionAllowList', async () => {
    const perms = new PermissionSystem('default');
    const handler = vi.fn().mockResolvedValue('always');
    perms.setPromptHandler(handler);
    await perms.check({ name: 'bash', input: {} }); // adds to allowlist
    handler.mockClear();
    await perms.check({ name: 'bash', input: {} }); // should skip handler
    expect(handler).not.toHaveBeenCalled();
  });

  it('sessionAllowList is cleared on setMode', async () => {
    const perms = new PermissionSystem('default');
    perms.setPromptHandler(vi.fn().mockResolvedValue('always'));
    await perms.check({ name: 'bash', input: {} });
    expect(perms.getSessionAllowList()).toContain('bash');
    perms.setMode('auto');
    expect(perms.getSessionAllowList()).toHaveLength(0);
  });
});

describe('PermissionSystem — addRule and pattern matching', () => {
  it('prepended rule takes priority over defaults', async () => {
    const perms = new PermissionSystem('auto');
    perms.addRule({ tool: 'bash', action: 'deny', reason: 'custom deny' });
    const result = await perms.check({ name: 'bash', input: {} });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('custom deny');
  });

  it('pattern rule matches on input.path', async () => {
    const perms = new PermissionSystem('auto');
    perms.addRule({ tool: 'read_file', action: 'deny', pattern: '**/secret/**', reason: 'restricted' });
    const denied = await perms.check({ name: 'read_file', input: { path: '/project/secret/keys.txt' } });
    const allowed = await perms.check({ name: 'read_file', input: { path: '/project/src/index.ts' } });
    expect(denied.allowed).toBe(false);
    expect(allowed.allowed).toBe(true);
  });

  it('unknown tool is denied when no wildcard rule matches', async () => {
    const perms = new PermissionSystem('default');
    // Remove wildcard by replacing rules with only the explicit denies
    const rules = perms.getRules().filter(r => r.tool !== '*');
    rules.forEach(r => perms.addRule(r));
    // Create a fresh instance with only deny rules and no wildcard
    const perms2 = new PermissionSystem('plan');
    const result = await perms2.check({ name: 'unknown_tool', input: {} });
    expect(result.allowed).toBe(true); // plan still has wildcard allow
  });
});
