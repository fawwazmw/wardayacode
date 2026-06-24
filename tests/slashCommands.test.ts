import { describe, it, expect, vi } from 'vitest';
import { handleSlashCommand, filterCommands, SLASH_COMMANDS, type SlashCommandContext } from '../src/ui/SlashCommands.js';

function createMockContext(overrides: Partial<SlashCommandContext> = {}): SlashCommandContext {
  return {
    clearMessages: vi.fn(),
    setPermissionMode: vi.fn(),
    getSessionId: () => 'test-session-id-1234',
    getModel: () => 'claude-sonnet-4-20250514',
    getVersion: () => '0.5.0',
    getPermissionMode: () => 'default',
    getTokenUsage: () => ({ input: 100, output: 200 }),
    getMessageCount: () => 5,
    exit: vi.fn(),
    undo: vi.fn().mockResolvedValue('Undid edit_file on src/foo.ts'),
    checkpoint: vi.fn().mockResolvedValue('Checkpoint created (git stash).'),
    rollback: vi.fn().mockResolvedValue('Rolled back to last checkpoint.'),
    diff: vi.fn().mockResolvedValue(' src/foo.ts | 2 +-'),
    compact: vi.fn().mockResolvedValue('Context compacted: 2 layer(s) applied, ~1,234 tokens remaining.'),
    ...overrides,
  };
}

describe('handleSlashCommand', () => {
  it('ignores non-slash input', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('hello world', ctx);
    expect(result.handled).toBe(false);
  });

  it('handles /help', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/help', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('/help');
    expect(result.output).toContain('/clear');
  });

  it('handles /status', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/status', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('0.5.0');
    expect(result.output).toContain('claude-sonnet-4-20250514');
    expect(result.output).toContain('default');
    expect(result.output).toContain('test-session-id-1234');
    expect(result.output).toContain('Messages: 5');
  });

  it('handles /clear', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/clear', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.clearMessages).toHaveBeenCalled();
  });

  it('handles /session', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/session', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('test-session-id-1234');
    expect(result.output).toContain('claude-sonnet');
  });

  it('handles /mode without arg (shows current)', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/mode', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('default');
  });

  it('handles /mode with valid arg', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/mode auto', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setPermissionMode).toHaveBeenCalledWith('auto');
  });

  it('handles /mode with invalid arg', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/mode invalid', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Invalid mode');
  });

  it('handles /model', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/model', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('claude-sonnet-4-20250514');
  });

  it('handles /tokens', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/tokens', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('100');
    expect(result.output).toContain('200');
  });

  it('handles /undo', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/undo', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.undo).toHaveBeenCalled();
    expect(result.output).toContain('Undid');
  });

  it('handles /checkpoint', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/checkpoint', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.checkpoint).toHaveBeenCalled();
    expect(result.output).toContain('Checkpoint');
  });

  it('handles /rollback', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/rollback', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.rollback).toHaveBeenCalled();
    expect(result.output).toContain('Rolled back');
  });

  it('handles /diff', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/diff', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.diff).toHaveBeenCalled();
    expect(result.output).toContain('src/foo.ts');
  });

  it('handles /exit', async () => {
    const ctx = createMockContext();
    await handleSlashCommand('/exit', ctx);
    expect(ctx.exit).toHaveBeenCalled();
  });

  it('handles /quit', async () => {
    const ctx = createMockContext();
    await handleSlashCommand('/quit', ctx);
    expect(ctx.exit).toHaveBeenCalled();
  });

  it('handles unknown command', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/unknown', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Unknown command');
  });
});

describe('filterCommands', () => {
  it('returns all commands for bare /', () => {
    const results = filterCommands('/');
    expect(results.length).toBe(SLASH_COMMANDS.length);
  });

  it('filters by prefix', () => {
    const results = filterCommands('/cl');
    expect(results.length).toBe(1);
    expect(results[0]!.name).toBe('/clear');
  });

  it('filters multiple matches', () => {
    const results = filterCommands('/ch');
    expect(results.length).toBe(1);
    expect(results[0]!.name).toBe('/checkpoint');
  });

  it('returns empty for non-slash input', () => {
    expect(filterCommands('hello')).toHaveLength(0);
    expect(filterCommands('')).toHaveLength(0);
  });

  it('returns empty for no match', () => {
    expect(filterCommands('/zzz')).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const results = filterCommands('/CL');
    expect(results.length).toBe(1);
    expect(results[0]!.name).toBe('/clear');
  });
});

describe('SLASH_COMMANDS registry', () => {
  it('has all expected commands', () => {
    const names = SLASH_COMMANDS.map(c => c.name);
    expect(names).toContain('/help');
    expect(names).toContain('/status');
    expect(names).toContain('/clear');
    expect(names).toContain('/login');
    expect(names).toContain('/logout');
    expect(names).toContain('/auth');
    expect(names).toContain('/undo');
    expect(names).toContain('/diff');
    expect(names).toContain('/checkpoint');
    expect(names).toContain('/rollback');
    expect(names).toContain('/exit');
  });

  it('every command has a description', () => {
    for (const cmd of SLASH_COMMANDS) {
      expect(cmd.description.length).toBeGreaterThan(0);
    }
  });

  it('/mode has args defined', () => {
    const mode = SLASH_COMMANDS.find(c => c.name === '/mode');
    expect(mode?.args).toBeDefined();
  });

  it('/compact is in SLASH_COMMANDS', () => {
    const compact = SLASH_COMMANDS.find(c => c.name === '/compact');
    expect(compact).toBeDefined();
    expect(compact?.description).toBeTruthy();
  });
});

describe('handleSlashCommand /compact', () => {
  it('calls ctx.compact and returns output', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/compact', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.compact).toHaveBeenCalled();
    expect(result.output).toContain('compacted');
  });
});
