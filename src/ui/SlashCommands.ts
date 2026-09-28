import type { PermissionMode } from '../types.js';

export interface SlashCommandEntry {
  name: string;
  description: string;
  args?: string;
}

export const SLASH_COMMANDS: SlashCommandEntry[] = [
  { name: '/help', description: 'Show available commands' },
  { name: '/status', description: 'Show version, model, mode, session, and usage stats' },
  { name: '/cost', description: 'Show total cost and duration of the current session' },
  { name: '/theme', description: 'Change the theme', args: '<dark|light>' },
  { name: '/export', description: 'Export the current conversation to a file' },
  { name: '/rename', description: 'Rename the current conversation', args: '<name>' },
  { name: '/context', description: 'Visualize current context usage stats' },
  { name: '/resume', description: 'Resume a previous conversation', args: '<session-id>' },
  { name: '/init', description: 'Initialize a new WARDAYA.md file with codebase documentation' },
  { name: '/plan', description: 'Switch to plan mode (read-only, no destructive actions)' },
  { name: '/stats', description: 'Show usage statistics and activity for this session' },
  { name: '/config', description: 'Show current configuration summary' },
  { name: '/keybindings', description: 'Open or create your keybindings configuration file' },
  { name: '/skills', description: 'List available skills' },
  { name: '/copy', description: "Copy the last response to clipboard", args: '[N]' },
  { name: '/feedback', description: 'Submit feedback about WardayaCode' },
  { name: '/hooks', description: 'View hook configurations for tool events' },
  { name: '/memory', description: 'Edit Wardaya memory files' },
  { name: '/anw', description: 'Ask a quick side question without interrupting the main conversation' },
  { name: '/effort', description: 'Set effort level for model usage', args: '<level>' },
  { name: '/tui', description: 'Set the terminal UI renderer (default only)', args: '<mode>' },
  { name: '/stickers', description: 'Get link to order WardayaCode stickers' },
  { name: '/permissions', description: 'Manage allow & deny tool permission rules' },
  { name: '/doctor', description: 'Diagnose and verify your WardayaCode installation and settings' },
  { name: '/agents', description: 'Manage agent configurations' },
  { name: '/branch', description: 'Create a branch of the current conversation at this point', args: '<name>' },
  { name: '/mcp', description: 'Manage MCP servers' },
  { name: '/review', description: 'Review a pull request' },
  { name: '/sandbox', description: 'Configure the sandbox' },
  { name: '/security-review', description: 'Complete a security review of the pending changes on the current branch' },
  { name: '/clear', description: 'Clear chat history' },
  { name: '/compact', description: 'Manually compact context to free tokens' },
  { name: '/session', description: 'Show current session info' },
  { name: '/mode', description: 'Change permission mode', args: '<mode>' },
  { name: '/model', description: 'Show current model' },
  { name: '/tokens', description: 'Show token usage' },
  { name: '/login', description: 'Save provider API key', args: '<provider> <apiKey>' },
  { name: '/logout', description: 'Remove stored provider API key', args: '<provider>' },
  { name: '/auth', description: 'List provider auth status' },
  { name: '/undo', description: 'Undo last file edit' },
  { name: '/diff', description: 'Show uncommitted git changes' },
  { name: '/checkpoint', description: 'Create a git stash checkpoint' },
  { name: '/rollback', description: 'Rollback to last checkpoint' },
  { name: '/exit', description: 'Exit wardayacode' },
];

export function filterCommands(input: string): SlashCommandEntry[] {
  if (!input.startsWith('/')) return [];
  const query = input.toLowerCase();
  if (query === '/') return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(cmd => cmd.name.startsWith(query));
}

export interface SessionListInfo {
  id: string;
  createdAt: Date;
  messageCount: number;
  firstMessage?: string;
}

export interface SlashCommandContext {
  clearMessages: () => void;
  setPermissionMode: (mode: PermissionMode) => void;
  setThemeMode: (mode: 'dark' | 'light') => void;
  copyLastResponse: () => Promise<string>;
  setEffort: (level: string) => void;
  getEffort: () => string;
  setTuiRenderer: (renderer: string) => string;
  getAgentConfigSummary: () => string;
  createBranch: (name: string) => Promise<string>;
  runSecurityReview: () => Promise<string>;
  getSessionId: () => string;
  getSessionName: () => string;
  setSessionName: (name: string) => void;
  getModel: () => string;
  getVersion: () => string;
  getPermissionMode: () => PermissionMode;
  /** Human-readable list of the active permission rules. */
  getPermissionRules: () => string;
  getTokenUsage: () => { input: number; output: number };
  getSessionDuration: () => number;
  getMessageCount: () => number;
  getContextStats: () => { messageCount: number; estimatedTokens: number; shouldCompact: boolean };
  getConfigSummary: () => string;
  openKeybindings: () => Promise<string>;
  exportSession: () => Promise<string>;
  listSessions: () => Promise<SessionListInfo[]>;
  resumeSession: (sessionId: string) => Promise<string>;
  initWardayaDoc: () => Promise<string>;
  exit: () => void;
  undo: () => Promise<string>;
  checkpoint: () => Promise<string>;
  rollback: () => Promise<string>;
  diff: () => Promise<string>;
  compact: () => Promise<string>;
  openUrl: (url: string) => Promise<string>;
  getProjectRoot: () => string;
  /** List configured MCP servers. */
  mcpList: () => Promise<string>;
  /** Connect an MCP server by name. */
  mcpConnect: (name: string) => Promise<string>;
  /** Disconnect an MCP server by name. */
  mcpDisconnect: (name: string) => Promise<string>;
  /** Show MCP server connection status. */
  mcpStatus: () => Promise<string>;
  /** Human-readable hook status. */
  getHooksInfo: () => Promise<string>;
  /** Trust the current project's hooks and activate them. */
  trustHooks: () => Promise<string>;
  /** Enable or disable the sandbox. */
  setSandboxEnabled: (enabled: boolean) => void;
  /** Get sandbox enabled state. */
  getSandboxEnabled: () => boolean;
  /** Submit a side question without affecting the main conversation. */
  askSideQuestion: (question: string) => Promise<string>;
  /** List open PRs via gh CLI. */
  listOpenPRs: () => Promise<string>;
}

export interface SlashCommandResult {
  handled: boolean;
  output?: string;
}

const VALID_MODES: PermissionMode[] = ['default', 'plan', 'acceptEdits', 'auto', 'internal'];

/** Per-million-token pricing for cost estimation. Falls back to Sonnet for unknown models. */
function estimateCost(model: string, inputTokens: number, outputTokens: number): { inputCost: number; outputCost: number; totalCost: number; inputRate: number; outputRate: number } {
  const m = model.toLowerCase();
  let inputRate: number;
  let outputRate: number;
  if (m.startsWith('claude-opus')) {
    inputRate = 15;
    outputRate = 75;
  } else if (m.startsWith('claude-haiku')) {
    inputRate = 0.25;
    outputRate = 1.25;
  } else {
    // claude-sonnet (or unknown) default
    inputRate = 3;
    outputRate = 15;
  }
  const inputCost = (inputTokens / 1_000_000) * inputRate;
  const outputCost = (outputTokens / 1_000_000) * outputRate;
  return { inputCost, outputCost, totalCost: inputCost + outputCost, inputRate, outputRate };
}

/** Format a duration in milliseconds to a human-readable string like "5m 32s". */
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export async function handleSlashCommand(
  input: string,
  ctx: SlashCommandContext
): Promise<SlashCommandResult> {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return { handled: false };
  }

  const parts = trimmed.split(/\s+/);
  const command = parts[0]!.toLowerCase();
  const arg = parts[1];

  switch (command) {
    case '/help':
    case '/h': {
      const lines = SLASH_COMMANDS.map(cmd => {
        const argStr = cmd.args ? ` ${cmd.args}` : '';
        const padded = (cmd.name + argStr).padEnd(22);
        return `  ${padded} ${cmd.description}`;
      });
      lines.push('');
      lines.push('  Ctrl+C               Cancel / Clear / Exit');
      lines.push('  Ctrl+D               Exit wardayacode');
      return { handled: true, output: lines.join('\n') };
    }

    case '/status': {
      const sUsage = ctx.getTokenUsage();
      const sDur = formatDuration(ctx.getSessionDuration());
      const lines = [
        `Version:  ${ctx.getVersion()}`,
        `Model:    ${ctx.getModel()}`,
        `Mode:     ${ctx.getPermissionMode()}`,
        `Effort:   ${ctx.getEffort()}`,
        `Session:  ${ctx.getSessionId().slice(0, 8)}`,
        `Uptime:   ${sDur}`,
        `Messages: ${ctx.getMessageCount()}`,
        `Tokens:   ~${sUsage.input.toLocaleString()} in / ~${sUsage.output.toLocaleString()} out`,
      ];
      return { handled: true, output: lines.join('\n') };
    }

    case '/cost': {
      const cModel = ctx.getModel();
      const cUsage = ctx.getTokenUsage();
      const { inputCost, outputCost, totalCost, inputRate, outputRate } = estimateCost(cModel, cUsage.input, cUsage.output);
      const fmt = (n: number) => n.toFixed(4);
      const dur = formatDuration(ctx.getSessionDuration());
      const lines = [
        `Cost estimate (${cModel}):`,
        `  Input:  ~${cUsage.input.toLocaleString()} tokens × $${inputRate.toFixed(2)}/M = $${fmt(inputCost)}`,
        `  Output: ~${cUsage.output.toLocaleString()} tokens × $${outputRate.toFixed(2)}/M = $${fmt(outputCost)}`,
        `  Total:                                       $${fmt(totalCost)}`,
        `  Duration: ${dur}`,
      ];
      return { handled: true, output: lines.join('\n') };
    }

    case '/theme': {
      if (arg === 'dark' || arg === 'light') {
        ctx.setThemeMode(arg);
        return { handled: true, output: `Theme changed to ${arg}.` };
      }
      return { handled: true, output: 'Usage: /theme <dark|light>' };
    }

    case '/export':
      return { handled: true, output: await ctx.exportSession() };

    case '/rename': {
      if (!arg) {
        const curName = ctx.getSessionName();
        return { handled: true, output: curName ? `Session name: ${curName}` : 'No session name set. Usage: /rename <name>' };
      }
      const newName = parts.slice(1).join(' ').trim();
      ctx.setSessionName(newName);
      return { handled: true, output: `Session renamed to: ${newName}` };
    }

    case '/context': {
      const cs = ctx.getContextStats();
      return {
        handled: true,
        output: [
          'Context usage:',
          `  Messages:     ${cs.messageCount}`,
          `  Tokens (est): ~${cs.estimatedTokens.toLocaleString()} / 100,000`,
          `  Compaction:   ${cs.shouldCompact ? 'recommended (/compact)' : 'not needed'}`,
        ].join('\n'),
      };
    }

    case '/resume': {
      if (!arg) {
        const sessions = await ctx.listSessions();
        if (sessions.length === 0) {
          return { handled: true, output: 'No previous sessions found.' };
        }
        const lines = sessions.map(s => {
          const date = s.createdAt.toLocaleDateString();
          const idShort = s.id.slice(0, 8);
          const preview = s.firstMessage ? ` — "${s.firstMessage}"` : '';
          return `  ${idShort}  ${date}  ${s.messageCount} msgs${preview}`;
        });
        return { handled: true, output: `Available sessions:\n${lines.join('\n')}\n\nUse /resume <session-id-prefix> to load one.` };
      }
      return { handled: true, output: await ctx.resumeSession(arg) };
    }

    case '/init':
      return { handled: true, output: await ctx.initWardayaDoc() };

    case '/plan':
      ctx.setPermissionMode('plan');
      return { handled: true, output: 'Switched to plan mode (read-only). Use /mode to change.' };

    case '/stats': {
      const stUsage = ctx.getTokenUsage();
      const stDur = formatDuration(ctx.getSessionDuration());
      const modelShort = ctx.getModel().split('/').pop() ?? ctx.getModel();
      return {
        handled: true,
        output: [
          `Model:     ${modelShort}`,
          `Mode:      ${ctx.getPermissionMode()}`,
          `Messages:  ${ctx.getMessageCount()}`,
          `Tokens in: ~${stUsage.input.toLocaleString()}`,
          `Tokens out:~${stUsage.output.toLocaleString()}`,
          `Duration:  ${stDur}`,
        ].join('\n'),
      };
    }

    case '/config':
      return { handled: true, output: ctx.getConfigSummary() };

    case '/keybindings':
      return { handled: true, output: await ctx.openKeybindings() };

    case '/skills': {
      const { loadSkills } = await import('../extensibility/skillLoader.js');
      const skills = await loadSkills(ctx.getProjectRoot());
      if (skills.length === 0) {
        return { handled: true, output: 'No skills found.\nAdd .md files to .wardayacode/skills/ or ~/.config/wardayacode/skills/ to define skills.\nSkills are injected into the agent when relevant.' };
      }
      const lines = skills.map(s => `  ${s.name.padEnd(20)} ${s.description}`);
      return { handled: true, output: `Skills (${skills.length}):\n${lines.join('\n')}\n\nSkills are injected into the agent when relevant.` };
    }

    case '/copy':
      return { handled: true, output: await ctx.copyLastResponse() };

    case '/feedback':
      return { handled: true, output: await ctx.openUrl('https://github.com/fawwazmw/wardayacode/issues/new/choose') };

    case '/hooks': {
      if (arg === 'trust') {
        return { handled: true, output: await ctx.trustHooks() };
      }
      return { handled: true, output: await ctx.getHooksInfo() };
    }

    case '/memory': {
      const { existsSync, readdirSync, readFileSync } = await import('fs');
      const { join } = await import('path');
      const { homedir } = await import('os');
      const memDirs = [
        join(ctx.getProjectRoot(), '.wardayacode', 'memory'),
        join(homedir(), '.config', 'wardayacode', 'memory'),
      ];
      const files: { name: string; path: string }[] = [];
      for (const dir of memDirs) {
        if (!existsSync(dir)) continue;
        for (const f of readdirSync(dir).filter(f => f.endsWith('.md'))) {
          files.push({ name: f, path: join(dir, f) });
        }
      }
      const locations = 'Memory files are stored in .wardayacode/memory/ or ~/.config/wardayacode/memory/.';
      if (files.length === 0) {
        return { handled: true, output: `No memory files found.\n${locations}\nUse /memory <topic> to view or create a memory entry.` };
      }
      if (arg) {
        const match = files.find(f => f.name.toLowerCase().includes(arg.toLowerCase()));
        if (!match) {
          return { handled: true, output: `No memory found matching "${arg}".\nAvailable topics:\n  ${files.map(f => f.name.replace('.md', '')).join('\n  ')}` };
        }
        const content = readFileSync(match.path, 'utf-8');
        return { handled: true, output: `${match.name.replace('.md', '')}:\n${content.trim()}` };
      }
      return { handled: true, output: `Memory files:\n  ${files.map(f => f.name.replace('.md', '')).join('\n  ')}\n\n${locations}\nUse /memory <topic> to view a memory entry.` };
    }

    case '/anw': {
      if (!arg) {
        return { handled: true, output: 'Usage: /anw <question>\nAsk a quick side question without interrupting the main conversation.' };
      }
      return { handled: true, output: await ctx.askSideQuestion(parts.slice(1).join(' ').trim()) };
    }

    case '/effort': {
      if (!arg) {
        return { handled: true, output: `Current effort level: ${ctx.getEffort()}\nUsage: /effort <low|medium|high>` };
      }
      ctx.setEffort(arg);
      return { handled: true, output: `Effort level set to: ${arg}` };
    }

    case '/tui': {
      if (!arg) {
        return { handled: true, output: 'Usage: /tui <default>\nOnly the default renderer is available. "fullscreen" mode is not implemented.' };
      }
      return { handled: true, output: ctx.setTuiRenderer(arg) };
    }

    case '/stickers':
      return { handled: true, output: await ctx.openUrl('https://github.com/fawwazmw/wardayacode') };

    case '/permissions':
      return { handled: true, output: ctx.getPermissionRules() };

    case '/doctor': {
      const { execSync } = await import('node:child_process');
      const issues: string[] = [];

      // Version
      try {
        const v = ctx.getVersion();
        if (v) issues.push(`✓ Version: ${v}`);
      } catch { issues.push('✗ Version: unknown'); }

      // Model
      issues.push(`✓ Model: ${ctx.getModel()}`);

      // Session
      issues.push(`✓ Session: ${ctx.getSessionId().slice(0, 8)}`);

      // Permission mode
      issues.push(`✓ Mode: ${ctx.getPermissionMode()}`);

      // Git availability
      try {
        execSync('git --version', { stdio: 'pipe' });
        issues.push('✓ Git: available');
      } catch {
        issues.push('✗ Git: not found');
      }

      // Project root exists
      const root = ctx.getProjectRoot();
      try {
        const { existsSync } = await import('fs');
        issues.push(`✓ Project root: ${existsSync(root) ? 'exists' : 'missing'}`);
      } catch { issues.push('✓ Project root: readable'); }

      return { handled: true, output: `WardayaCode diagnostics:\n${issues.join('\n')}` };
    }

    case '/agents':
      return { handled: true, output: ctx.getAgentConfigSummary() };

    case '/branch': {
      if (!arg) {
        return { handled: true, output: 'Usage: /branch <name>\nCreates a git branch with a checkpoint of the current state.' };
      }
      return { handled: true, output: await ctx.createBranch(arg) };
    }

    case '/mcp': {
      if (arg === 'list') {
        return { handled: true, output: await ctx.mcpList() };
      }
      if (arg === 'connect' && parts[2]) {
        return { handled: true, output: await ctx.mcpConnect(parts[2]!) };
      }
      if (arg === 'disconnect' && parts[2]) {
        return { handled: true, output: await ctx.mcpDisconnect(parts[2]!) };
      }
      return { handled: true, output: await ctx.mcpStatus() };
    }

    case '/review':
      return { handled: true, output: await ctx.listOpenPRs() };

    case '/sandbox': {
      const enabled = ctx.getSandboxEnabled();
      if (arg === 'enable') {
        ctx.setSandboxEnabled(true);
        return { handled: true, output: 'Sandbox enabled. Bash, git, and write tools are now blocked.' };
      }
      if (arg === 'disable') {
        ctx.setSandboxEnabled(false);
        return { handled: true, output: 'Sandbox disabled. Tool restrictions removed.' };
      }
      return { handled: true, output: `Sandbox: ${enabled ? 'enabled' : 'disabled'}\nSandbox denies bash, git, write, and edit tools.\nUse /sandbox enable or /sandbox disable.` };
    }

    case '/security-review': {
      const diff = await ctx.diff();
      if (diff === 'No uncommitted changes.' || !diff) {
        return { handled: true, output: 'No uncommitted changes to review.' };
      }
      return { handled: true, output: await ctx.runSecurityReview() };
    }

    case '/clear':
      ctx.clearMessages();
      return { handled: true, output: 'Chat cleared.' };

    case '/compact':
      return { handled: true, output: await ctx.compact() };

    case '/session':
      return {
        handled: true,
        output: `Session: ${ctx.getSessionId()}\nModel: ${ctx.getModel()}\nMode: ${ctx.getPermissionMode()}\nMessages: ${ctx.getMessageCount()}`,
      };

    case '/mode': {
      if (!arg) {
        return { handled: true, output: `Current mode: ${ctx.getPermissionMode()}\nAvailable: ${VALID_MODES.join(', ')}` };
      }
      if (!VALID_MODES.includes(arg as PermissionMode)) {
        return { handled: true, output: `Invalid mode: ${arg}\nAvailable: ${VALID_MODES.join(', ')}` };
      }
      ctx.setPermissionMode(arg as PermissionMode);
      return { handled: true, output: `Permission mode changed to: ${arg}` };
    }

    case '/model':
      return { handled: true, output: `Model: ${ctx.getModel()}` };

    case '/tokens': {
      const usage = ctx.getTokenUsage();
      return { handled: true, output: `Tokens — Input: ~${usage.input} | Output: ~${usage.output} | Total: ~${usage.input + usage.output}` };
    }

    case '/undo':
      return { handled: true, output: await ctx.undo() };

    case '/checkpoint':
      return { handled: true, output: await ctx.checkpoint() };

    case '/rollback':
      return { handled: true, output: await ctx.rollback() };

    case '/diff':
      return { handled: true, output: await ctx.diff() };

    case '/exit':
    case '/quit':
    case '/q':
      ctx.exit();
      return { handled: true };

    default:
      return { handled: true, output: `Unknown command: ${command}\nType /help for available commands.` };
  }
}
