import { describe, it, expect, vi } from 'vitest';
import { handleSlashCommand, filterCommands, SLASH_COMMANDS, type SlashCommandContext } from '../src/ui/SlashCommands.js';

function createMockContext(overrides: Partial<SlashCommandContext> = {}): SlashCommandContext {
  return {
    clearMessages: vi.fn(),
    setPermissionMode: vi.fn(),
    getSessionId: () => 'test-session-id-1234',
    getModel: () => 'claude-sonnet-4-20250514',
    getPermissionMode: () => 'default',
    getTokenUsage: () => ({ input: 100, output: 200 }),
    getMessageCount: () => 5,
    exit: vi.fn(),
    ...overrides,
  };
}

describe('handleSlashCommand', () => {
  it('ignores non-slash input', () => {
    const ctx = createMockContext();
    const result = handleSlashCommand('hello world', ctx);
    expect(result.handled).toBe(false);
  });

  it('handles /help', () => {
    const ctx = createMockContext();
    const result = handleSlashCommand('/help', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('/help');
    expect(result.output).toContain('/clear');
  });

  it('handles /clear', () => {
    const ctx = createMockContext();
    const result = handleSlashCommand('/clear', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.clearMessages).toHaveBeenCalled();
  });

  it('handles /session', () => {
    const ctx = createMockContext();
    const result = handleSlashCommand('/session', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('test-session-id-1234');
    expect(result.output).toContain('claude-sonnet');
  });

  it('handles /mode without arg (shows current)', () => {
    const ctx = createMockContext();
    const result = handleSlashCommand('/mode', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('default');
  });

  it('handles /mode with valid arg', () => {
    const ctx = createMockContext();
    const result = handleSlashCommand('/mode auto', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setPermissionMode).toHaveBeenCalledWith('auto');
  });

  it('handles /mode with invalid arg', () => {
    const ctx = createMockContext();
    const result = handleSlashCommand('/mode invalid', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Invalid mode');
  });

  it('handles /tokens', () => {
    const ctx = createMockContext();
    const result = handleSlashCommand('/tokens', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('100');
    expect(result.output).toContain('200');
  });

  it('handles /exit', () => {
    const ctx = createMockContext();
    handleSlashCommand('/exit', ctx);
    expect(ctx.exit).toHaveBeenCalled();
  });

  it('handles /quit', () => {
    const ctx = createMockContext();
    handleSlashCommand('/quit', ctx);
    expect(ctx.exit).toHaveBeenCalled();
  });

  it('handles unknown command', () => {
    const ctx = createMockContext();
    const result = handleSlashCommand('/unknown', ctx);
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
});
