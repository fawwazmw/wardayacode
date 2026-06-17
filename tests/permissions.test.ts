import { describe, it, expect } from 'vitest';
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
