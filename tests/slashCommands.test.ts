import { describe, it, expect, vi } from 'vitest';
import { handleSlashCommand, filterCommands, SLASH_COMMANDS, type SlashCommandContext } from '../src/ui/SlashCommands.js';

function createMockContext(overrides: Partial<SlashCommandContext> = {}): SlashCommandContext {
  return {
    clearMessages: vi.fn(),
    setPermissionMode: vi.fn(),
    setThemeMode: vi.fn(),
    getSessionId: () => 'test-session-id-1234',
    getSessionName: () => '',
    setSessionName: vi.fn(),
    getModel: () => 'claude-sonnet-4-20250514',
    getVersion: () => '0.5.0',
    getPermissionMode: () => 'default',
    getTokenUsage: () => ({ input: 100, output: 200 }),
    getSessionDuration: () => 60000,
    getMessageCount: () => 5,
    getContextStats: () => ({ messageCount: 10, estimatedTokens: 4200, shouldCompact: false }),
    exportSession: vi.fn().mockResolvedValue('Conversation exported to wardayacode-export-test1234.md'),
    listSessions: vi.fn().mockResolvedValue([
      { id: 'abc123', createdAt: new Date('2024-01-01'), messageCount: 42, firstMessage: 'hello' },
    ]),
    resumeSession: vi.fn().mockResolvedValue('Resumed session abc123 (42 messages)'),
    initWardayaDoc: vi.fn().mockResolvedValue('WARDAYA.md created in /test'),
    getFastMode: () => false,
    setFastMode: vi.fn(),
    getColor: () => 'accent',
    setColor: vi.fn(),
    copyLastResponse: vi.fn().mockResolvedValue('Last response: Hello!'),
    getEffort: () => 'medium',
    setEffort: vi.fn(),
    setTuiRenderer: (r: string) => `TUI renderer set to: ${r}`,
    getDirectories: () => ['/test'],
    addDirectory: vi.fn().mockReturnValue('Added directory: /new'),
    getAgentConfigSummary: () => 'Model: claude-sonnet-4\nMax tokens: 4096\nTemperature: 0',
    createBranch: vi.fn().mockResolvedValue('Branch created: test-branch'),
    listPlugins: () => [],
    reloadPlugins: vi.fn().mockResolvedValue('Plugins reloaded.'),
    getSandboxStatus: () => 'Sandbox: disabled',
    runSecurityReview: vi.fn().mockResolvedValue('Security review: no issues found'),
    getConfigSummary: () => 'Model: claude-sonnet-4\nVersion: 0.5.0\nTheme: dark\nMode: default',
    openKeybindings: vi.fn().mockResolvedValue('Keybindings file: /test/.wardayacode/keybindings.json'),
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

  it('handles /cost', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/cost', ctx);
    expect(result.handled).toBe(true);
    // 100 input @ $3/M + 200 output @ $15/M
    expect(result.output).toContain('$0.0003');
    expect(result.output).toContain('$0.0030');
    expect(result.output).toContain('$0.0033');
    expect(result.output).toContain('Duration: 1m');
  });

  it('handles /theme dark', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/theme dark', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setThemeMode).toHaveBeenCalledWith('dark');
    expect(result.output).toContain('dark');
  });

  it('handles /theme light', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/theme light', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setThemeMode).toHaveBeenCalledWith('light');
  });

  it('handles /theme with no arg or invalid arg', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/theme', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Usage');
  });

  it('handles /export', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/export', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.exportSession).toHaveBeenCalled();
    expect(result.output).toContain('wardayacode-export');
  });

  it('handles /rename setting a name', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/rename my session', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setSessionName).toHaveBeenCalledWith('my session');
    expect(result.output).toContain('my session');
  });

  it('handles /rename without arg showing current name', async () => {
    const ctx = createMockContext({ getSessionName: () => 'my-test' });
    const result = await handleSlashCommand('/rename', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('my-test');
  });

  it('handles /context', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/context', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('4,200');
    expect(result.output).toContain('not needed');
  });

  it('handles /resume listing sessions', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/resume', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.listSessions).toHaveBeenCalled();
    expect(result.output).toContain('abc123');
  });

  it('handles /resume with session id', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/resume abc123', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.resumeSession).toHaveBeenCalledWith('abc123');
    expect(result.output).toContain('abc123');
  });

  it('handles /init', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/init', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.initWardayaDoc).toHaveBeenCalled();
    expect(result.output).toContain('WARDAYA.md');
  });

  it('handles /insights', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/insights', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Messages: 5');
  });

  it('handles /plan', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/plan', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setPermissionMode).toHaveBeenCalledWith('plan');
    expect(result.output).toContain('plan');
  });

  it('handles /stats', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/stats', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Fast:');
    expect(result.output).toContain('5');
  });

  it('handles /fast toggle', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/fast', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setFastMode).toHaveBeenCalledWith(true);
    expect(result.output).toContain('enabled');
  });

  it('handles /config', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/config', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Model:');
    expect(result.output).toContain('Theme:');
  });

  it('handles /keybindings', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/keybindings', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.openKeybindings).toHaveBeenCalled();
    expect(result.output).toContain('keybindings.json');
  });

  it('handles /color without arg', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/color', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('accent');
  });

  it('handles /color with arg', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/color blue', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setColor).toHaveBeenCalledWith('blue');
  });

  it('handles /skills', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/skills', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('planning');
  });

  it('handles /release-notes', async () => {
    const ctx = createMockContext({ getVersion: () => '0.5.0' });
    const result = await handleSlashCommand('/release-notes', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('0.5.0');
    expect(result.output).toContain('github.com');
  });

  it('handles /recap', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/recap', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('5 msgs');
  });

  it('handles /copy', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/copy', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.copyLastResponse).toHaveBeenCalled();
  });

  it('handles /feedback', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/feedback', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('github.com');
  });

  it('handles /tasks', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/tasks', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('No active tasks');
  });

  it('handles /statusline', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/statusline', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Status line');
  });

  it('handles /hooks', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/hooks', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Hooks');
  });

  it('handles /memory', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/memory', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('~/.claude/memory');
  });

  it('handles /anw', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/anw', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('question');
  });

  it('handles /effort without arg', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/effort', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('medium');
  });

  it('handles /effort with arg', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/effort high', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setEffort).toHaveBeenCalledWith('high');
  });

  it('handles /tui', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/tui fullscreen', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('fullscreen');
  });

  it('handles /ide', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/ide', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('IDE');
  });

  it('handles /stickers', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/stickers', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('stickers');
  });

  it('handles /permissions', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/permissions', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Permission mode');
  });

  it('handles /team-onboarding', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/team-onboarding', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('onboarding');
  });

  it('handles /add-dir without arg', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/add-dir', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('/test');
  });

  it('handles /add-dir with path', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/add-dir /new', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.addDirectory).toHaveBeenCalledWith('/new');
  });

  it('handles /doctor', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/doctor', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('diagnostics');
  });

  it('handles /rewind', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/rewind', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Rewind');
  });

  it('handles /agents', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/agents', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('claude-sonnet-4');
  });

  it('handles /branch without arg', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/branch', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Usage');
  });

  it('handles /branch with name', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/branch my-feature', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.createBranch).toHaveBeenCalledWith('my-feature');
  });

  it('handles /mcp', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/mcp', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('MCP');
  });

  it('handles /plugin', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/plugin', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('No plugins');
  });

  it('handles /reload-plugins', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/reload-plugins', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.reloadPlugins).toHaveBeenCalled();
  });

  it('handles /review', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/review', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Pull request');
  });

  it('handles /sandbox', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/sandbox', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Sandbox');
  });

  it('handles /security-review with diff', async () => {
    const ctx = createMockContext({
      diff: vi.fn().mockResolvedValue('diff --git a/src/foo.ts b/src/foo.ts\n+api_key=secret'),
    });
    const result = await handleSlashCommand('/security-review', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.runSecurityReview).toHaveBeenCalled();
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
    expect(names).toContain('/cost');
    expect(names).toContain('/theme');
    expect(names).toContain('/export');
    expect(names).toContain('/rename');
    expect(names).toContain('/context');
    expect(names).toContain('/resume');
    expect(names).toContain('/init');
    expect(names).toContain('/insights');
    expect(names).toContain('/plan');
    expect(names).toContain('/stats');
    expect(names).toContain('/fast');
    expect(names).toContain('/config');
    expect(names).toContain('/keybindings');
    expect(names).toContain('/color');
    expect(names).toContain('/skills');
    expect(names).toContain('/release-notes');
    expect(names).toContain('/recap');
    expect(names).toContain('/copy');
    expect(names).toContain('/feedback');
    expect(names).toContain('/tasks');
    expect(names).toContain('/statusline');
    expect(names).toContain('/hooks');
    expect(names).toContain('/memory');
    expect(names).toContain('/anw');
    expect(names).toContain('/effort');
    expect(names).toContain('/tui');
    expect(names).toContain('/ide');
    expect(names).toContain('/stickers');
    expect(names).toContain('/permissions');
    expect(names).toContain('/team-onboarding');
    expect(names).toContain('/add-dir');
    expect(names).toContain('/doctor');
    expect(names).toContain('/rewind');
    expect(names).toContain('/agents');
    expect(names).toContain('/branch');
    expect(names).toContain('/mcp');
    expect(names).toContain('/plugin');
    expect(names).toContain('/reload-plugins');
    expect(names).toContain('/review');
    expect(names).toContain('/sandbox');
    expect(names).toContain('/security-review');
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
