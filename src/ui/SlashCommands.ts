import type { PermissionMode } from '../types.js';

export interface SlashCommandEntry {
  name: string;
  description: string;
  args?: string;
}

export const SLASH_COMMANDS: SlashCommandEntry[] = [
  { name: '/help', description: 'Show available commands' },
  { name: '/status', description: 'Show WardayaCode status including version, model, account, API connectivity, and tool statuses' },
  { name: '/cost', description: 'Show total cost and duration of the current session' },
  { name: '/theme', description: 'Change the theme', args: '<dark|light>' },
  { name: '/export', description: 'Export the current conversation to a file' },
  { name: '/rename', description: 'Rename the current conversation', args: '<name>' },
  { name: '/context', description: 'Visualize current context usage stats' },
  { name: '/resume', description: 'Resume a previous conversation', args: '<session-id>' },
  { name: '/init', description: 'Initialize a new WARDAYA.md file with codebase documentation' },
  { name: '/insights', description: 'Generate a report analyzing your WardayaCode sessions' },
  { name: '/plan', description: 'Switch to plan mode (read-only, no destructive actions)' },
  { name: '/stats', description: 'Show usage statistics and activity for this session' },
  { name: '/fast', description: 'Toggle fast mode for faster model responses' },
  { name: '/config', description: 'Show current configuration summary' },
  { name: '/keybindings', description: 'Open or create your keybindings configuration file' },
  { name: '/color', description: 'Set the prompt bar color for this session', args: '<color>' },
  { name: '/skills', description: 'List available skills' },
  { name: '/release-notes', description: 'View release notes' },
  { name: '/recap', description: 'Generate a one-line session recap' },
  { name: '/copy', description: "Copy the last response to clipboard", args: '[N]' },
  { name: '/feedback', description: 'Submit feedback about WardayaCode' },
  { name: '/tasks', description: 'List and manage background tasks' },
  { name: '/statusline', description: "Set up WardayaCode's status line UI" },
  { name: '/hooks', description: 'View hook configurations for tool events' },
  { name: '/memory', description: 'Edit Wardaya memory files' },
  { name: '/anw', description: 'Ask a quick side question without interrupting the main conversation' },
  { name: '/effort', description: 'Set effort level for model usage', args: '<level>' },
  { name: '/tui', description: 'Set the terminal UI renderer (default | fullscreen)', args: '<mode>' },
  { name: '/ide', description: 'Manage IDE integrations and show status' },
  { name: '/stickers', description: 'Get link to order WardayaCode stickers' },
  { name: '/permissions', description: 'Manage allow & deny tool permission rules' },
  { name: '/team-onboarding', description: 'Help teammates ramp on WardayaCode with a guide from your usage' },
  { name: '/add-dir', description: 'Add a new working directory' },
  { name: '/doctor', description: 'Diagnose and verify your WardayaCode installation and settings' },
  { name: '/rewind', description: 'Restore the code and/or conversation to a previous point' },
  { name: '/agents', description: 'Manage agent configurations' },
  { name: '/branch', description: 'Create a branch of the current conversation at this point', args: '<name>' },
  { name: '/mcp', description: 'Manage MCP servers' },
  { name: '/plugin', description: 'Manage WardayaCode plugins' },
  { name: '/reload-plugins', description: 'Activate pending plugin changes in the current session' },
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
  setColor: (color: string) => void;
  getColor: () => string;
  copyLastResponse: () => Promise<string>;
  setEffort: (level: string) => void;
  getEffort: () => string;
  setTuiRenderer: (renderer: string) => string;
  getDirectories: () => string[];
  addDirectory: (dir: string) => string;
  getAgentConfigSummary: () => string;
  createBranch: (name: string) => Promise<string>;
  listPlugins: () => string[];
  reloadPlugins: () => Promise<string>;
  getSandboxStatus: () => string;
  runSecurityReview: () => Promise<string>;
  getSessionId: () => string;
  getSessionName: () => string;
  setSessionName: (name: string) => void;
  getModel: () => string;
  getVersion: () => string;
  getPermissionMode: () => PermissionMode;
  getTokenUsage: () => { input: number; output: number };
  getSessionDuration: () => number;
  getMessageCount: () => number;
  getContextStats: () => { messageCount: number; estimatedTokens: number; shouldCompact: boolean };
  getFastMode: () => boolean;
  setFastMode: (fast: boolean) => void;
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
      const lines = [
        `Version:  ${ctx.getVersion()}`,
        `Model:    ${ctx.getModel()}`,
        `Mode:     ${ctx.getPermissionMode()}`,
        `Session:  ${ctx.getSessionId()}`,
        `Messages: ${ctx.getMessageCount()}`,
        `Tokens:   ~${sUsage.input} in / ~${sUsage.output} out`,
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

    case '/insights': {
      const iUsage = ctx.getTokenUsage();
      return { handled: true, output: `Session insights:\n  Messages: ${ctx.getMessageCount()}\n  Tokens in: ~${iUsage.input}\n  Tokens out: ~${iUsage.output}\n  Model: ${ctx.getModel()}\n  Duration: ${formatDuration(ctx.getSessionDuration())}` };
    }

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
          `Fast:      ${ctx.getFastMode() ? 'on' : 'off'}`,
          `Messages:  ${ctx.getMessageCount()}`,
          `Tokens in: ~${stUsage.input.toLocaleString()}`,
          `Tokens out:~${stUsage.output.toLocaleString()}`,
          `Duration:  ${stDur}`,
        ].join('\n'),
      };
    }

    case '/fast': {
      const newFast = !ctx.getFastMode();
      ctx.setFastMode(newFast);
      return { handled: true, output: `Fast mode ${newFast ? 'enabled' : 'disabled'}.` };
    }

    case '/config':
      return { handled: true, output: ctx.getConfigSummary() };

    case '/keybindings':
      return { handled: true, output: await ctx.openKeybindings() };

    case '/color': {
      if (!arg) {
        return { handled: true, output: `Current color: ${ctx.getColor()}\nUsage: /color <name>` };
      }
      ctx.setColor(arg);
      return { handled: true, output: `Color set to: ${arg}` };
    }

    case '/skills':
      return { handled: true, output: 'Available skills: planning, research, code review, debugging, testing, documentation' };

    case '/release-notes': {
      const v = ctx.getVersion();
      return { handled: true, output: `WardayaCode v${v}\nSee https://github.com/fawwazmw/wardayacode/releases for release notes.` };
    }

    case '/recap': {
      const rDur = formatDuration(ctx.getSessionDuration());
      const rUsage = ctx.getTokenUsage();
      return { handled: true, output: `Session: ${ctx.getMessageCount()} msgs, ${rDur}, ~${rUsage.input + rUsage.output} tokens used` };
    }

    case '/copy':
      return { handled: true, output: await ctx.copyLastResponse() };

    case '/feedback':
      return { handled: true, output: 'Feedback: https://github.com/fawwazmw/wardayacode/issues/new/choose' };

    case '/tasks':
      return { handled: true, output: 'Background tasks:\n  No active tasks. Use /run or & prefix to start tasks.' };

    case '/statusline':
      return { handled: true, output: 'Status line shows model, mode, tokens, and session info.\nUse /config to see current settings.' };

    case '/hooks':
      return { handled: true, output: 'Hooks are shell commands that run on tool events.\nConfigure them in .wardayacode/hooks/ or ~/.config/wardayacode/hooks/.' };

    case '/memory':
      return { handled: true, output: 'Wardaya memory files are stored in ~/.claude/memory/\nUse /memory <topic> to edit or view memory entries.' };

    case '/anw':
      return { handled: true, output: 'Side question mode:\nType your question after /anw and the response won\'t affect the conversation history.' };

    case '/effort': {
      if (!arg) {
        return { handled: true, output: `Current effort level: ${ctx.getEffort()}\nUsage: /effort <low|medium|high>` };
      }
      ctx.setEffort(arg);
      return { handled: true, output: `Effort level set to: ${arg}` };
    }

    case '/tui': {
      if (!arg) {
        return { handled: true, output: 'Usage: /tui <default|fullscreen>' };
      }
      return { handled: true, output: ctx.setTuiRenderer(arg) };
    }

    case '/ide':
      return { handled: true, output: 'IDE integrations:\n  WardayaCode supports VS Code and JetBrains IDEs.\n  Use /ide <vscode|jetbrains> to set up.' };

    case '/stickers':
      return { handled: true, output: 'Get WardayaCode stickers: https://github.com/fawwazmw/wardayacode' };

    case '/permissions':
      return { handled: true, output: `Permission mode: ${ctx.getPermissionMode()}\nUse /mode to change.\nRules are evaluated top-to-bottom; first match wins.` };

    case '/team-onboarding':
      return { handled: true, output: 'Team onboarding guide:\nShare your WardayaCode workflow with teammates.\nSee docs at https://github.com/fawwazmw/wardayacode' };

    case '/add-dir': {
      if (!arg) {
        const dirs = ctx.getDirectories();
        return { handled: true, output: dirs.length ? `Working directories:\n  ${dirs.join('\n  ')}` : 'No additional directories. Use /add-dir <path> to add one.' };
      }
      return { handled: true, output: ctx.addDirectory(arg) };
    }

    case '/doctor': {
      const issues: string[] = [];
      // Basic checks
      try {
        const v = ctx.getVersion();
        if (v) issues.push(`✓ Version: ${v}`);
      } catch { issues.push('✗ Could not determine version'); }
      issues.push(`✓ Model: ${ctx.getModel()}`);
      issues.push(`✓ Session: ${ctx.getSessionId().slice(0, 8)}`);
      return { handled: true, output: `WardayaCode diagnostics:\n${issues.join('\n')}` };
    }

    case '/rewind':
      return { handled: true, output: 'Rewind restores code and/or conversation to a previous state.\nUse /checkpoint to create save points, /rollback to restore.' };

    case '/agents':
      return { handled: true, output: ctx.getAgentConfigSummary() };

    case '/branch': {
      if (!arg) {
        return { handled: true, output: 'Usage: /branch <name>\nCreates a git branch with a checkpoint of the current state.' };
      }
      return { handled: true, output: await ctx.createBranch(arg) };
    }

    case '/mcp':
      return { handled: true, output: 'MCP (Model Context Protocol) servers extend WardayaCode with external tools.\nConfigure them in your config file or .wardayacode/mcp/.' };

    case '/plugin': {
      const plugins = ctx.listPlugins();
      if (plugins.length === 0) {
        return { handled: true, output: 'No plugins loaded.\nPlugins extend WardayaCode with custom functionality.' };
      }
      return { handled: true, output: `Loaded plugins:\n  ${plugins.join('\n  ')}` };
    }

    case '/reload-plugins':
      return { handled: true, output: await ctx.reloadPlugins() };

    case '/review':
      return { handled: true, output: 'Pull request review:\nUse `gh pr review` in the terminal or run WardayaCode in review mode with `wardayacode review`.\nUncommitted changes can be viewed with /diff.' };

    case '/sandbox':
      return { handled: true, output: ctx.getSandboxStatus() };

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
