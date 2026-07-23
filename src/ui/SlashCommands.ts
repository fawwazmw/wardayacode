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
  { name: '/tui', description: 'Set the terminal UI renderer (default only)', args: '<mode>' },
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
  openUrl: (url: string) => Promise<string>;
  getProjectRoot: () => string;
  /** Add a background task and return an ID. */
  addTask: (description: string) => number;
  /** List all tasks with status. Returns [{id, desc, status}]. */
  listTasks: () => { id: number; desc: string; status: string }[];
  /** Clear a task by id, or all tasks if no id. */
  clearTasks: (id?: number) => string;
  /** Scan the project for plugin files. Returns file paths relative to project root. */
  scanPlugins: () => string[];
  /** Scan the project for MCP configs. Returns file paths relative to project root. */
  scanMcpConfigs: () => string[];
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
        `Fast:     ${ctx.getFastMode() ? 'on' : 'off'}`,
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

    case '/skills': {
      const { existsSync, readdirSync, readFileSync } = await import('fs');
      const { join } = await import('path');
      const root = ctx.getProjectRoot();
      const skillsDir = join(root, '.wardayacode', 'skills');
      if (!existsSync(skillsDir)) {
        return { handled: true, output: 'No skills directory found.\nCreate .md or .js files in .wardayacode/skills/ to define custom skills.' };
      }
      const files = readdirSync(skillsDir).filter(f => f.endsWith('.md') || f.endsWith('.js'));
      if (files.length === 0) {
        return { handled: true, output: 'No skill files found in .wardayacode/skills/.\nCreate .md or .js files to define custom skills.' };
      }
      const lines: string[] = [];
      for (const f of files) {
        const name = f.replace(/\.(md|js)$/, '');
        let desc = f.endsWith('.md') ? 'Markdown skill' : 'JavaScript skill';
        // Try to extract the first heading line or a brief description from .md files
        if (f.endsWith('.md')) {
          try {
            const content = readFileSync(join(skillsDir, f), 'utf-8');
            const heading = content.match(/^#\s+(.+)/m);
            if (heading) desc = heading[1]!;
          } catch { /* use default description */ }
        }
        lines.push(`  ${name.padEnd(20)} ${desc}`);
      }
      return { handled: true, output: `Custom skills (${files.length}):\n${lines.join('\n')}\n\nSkills are loaded from .wardayacode/skills/.` };
    }

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
      return { handled: true, output: await ctx.openUrl('https://github.com/fawwazmw/wardayacode/issues/new/choose') };

    case '/tasks': {
      if (arg === 'clear') {
        return { handled: true, output: ctx.clearTasks() };
      }
      const taskId = arg ? Number(arg) : undefined;
      if (taskId !== undefined && !Number.isNaN(taskId)) {
        return { handled: true, output: ctx.clearTasks(taskId) };
      }
      const tasks = ctx.listTasks();
      if (tasks.length === 0) {
        return { handled: true, output: 'Background tasks:\n  No active tasks.' };
      }
      return {
        handled: true,
        output: `Background tasks (${tasks.length}):\n${tasks.map(t => `  [${t.id}] ${t.desc} — ${t.status}`).join('\n')}\nUse /tasks <id> to clear a task, /tasks clear to clear all.`,
      };
    }

    case '/statusline':
      return { handled: true, output: `Status line shows:\n  Model:     ${ctx.getModel()}\n  Mode:      ${ctx.getPermissionMode()}\n  Messages:  ${ctx.getMessageCount()}\n  Duration:  ${formatDuration(ctx.getSessionDuration())}\nUse /config to see full configuration.` };

    case '/hooks': {
      const { existsSync, readdirSync } = await import('fs');
      const { join } = await import('path');
      const { homedir } = await import('os');
      const hookDirs = [
        join(ctx.getProjectRoot(), '.wardayacode', 'hooks'),
        join(homedir(), '.config', 'wardayacode', 'hooks'),
      ];
      const hooks: string[] = [];
      for (const dir of hookDirs) {
        if (existsSync(dir)) {
          for (const f of readdirSync(dir).filter(f => f.endsWith('.sh'))) {
            hooks.push(f);
          }
        }
      }
      if (hooks.length === 0) {
        return { handled: true, output: 'No hook scripts found.\nHooks are shell commands that run on tool events.\nAdd .sh files to .wardayacode/hooks/ or ~/.config/wardayacode/hooks/.' };
      }
      return { handled: true, output: `Hook scripts:\n  ${hooks.join('\n  ')}` };
    }

    case '/memory': {
      const { existsSync, readdirSync, readFileSync } = await import('fs');
      const { join } = await import('path');
      const { homedir } = await import('os');
      const memDir = join(homedir(), '.claude', 'memory');
      if (!existsSync(memDir)) {
        return { handled: true, output: 'No memory files found.\nMemory files are stored in ~/.claude/memory/.\nUse /memory <topic> to view or create a memory entry.' };
      }
      const files = readdirSync(memDir).filter(f => f.endsWith('.md'));
      if (files.length === 0) {
        return { handled: true, output: 'No memory files found.\nMemory files are stored in ~/.claude/memory/.\nUse /memory <topic> to view or create a memory entry.' };
      }
      if (arg) {
        const topicFile = files.find(f => f.toLowerCase().includes(arg.toLowerCase()));
        if (!topicFile) {
          return { handled: true, output: `No memory found matching "${arg}".\nAvailable topics:\n  ${files.map(f => f.replace('.md', '')).join('\n  ')}` };
        }
        const content = readFileSync(join(memDir, topicFile), 'utf-8');
        return { handled: true, output: `${topicFile.replace('.md', '')}:\n${content.trim()}` };
      }
      return { handled: true, output: `Memory files:\n  ${files.map(f => f.replace('.md', '')).join('\n  ')}\n\nUse /memory <topic> to view a memory entry.` };
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

    case '/ide': {
      const root = ctx.getProjectRoot();
      const { existsSync } = await import('fs');
      const { join } = await import('path');
      const hasVscode = root ? existsSync(join(root, '.vscode')) : false;
      const hasJetbrains = root ? existsSync(join(root, '.idea')) : false;
      const lines = ['IDE integrations:'];
      lines.push(`  VS Code:    ${hasVscode ? '✓ .vscode/ detected' : '— not detected'}`);
      lines.push(`  JetBrains:  ${hasJetbrains ? '✓ .idea/ detected' : '— not detected'}`);
      if (!hasVscode && !hasJetbrains) {
        lines.push('');
        lines.push('  No IDE config found in the project root.');
      }
      return { handled: true, output: lines.join('\n') };
    }

    case '/stickers':
      return { handled: true, output: await ctx.openUrl('https://github.com/fawwazmw/wardayacode') };

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

    case '/mcp': {
      const configs = ctx.scanMcpConfigs();
      if (configs.length === 0) {
        return { handled: true, output: 'No MCP server configs found.\nMCP (Model Context Protocol) servers extend WardayaCode with external tools.\nAdd configs to .wardayacode/mcp/.' };
      }
      return { handled: true, output: `MCP server configs:\n  ${configs.join('\n  ')}\nUse /plugin to manage plugins.` };
    }

    case '/plugin': {
      const plugins = ctx.scanPlugins();
      if (plugins.length === 0) {
        return { handled: true, output: 'No plugins loaded.\nPlugins extend WardayaCode with custom functionality.' };
      }
      return { handled: true, output: `Loaded plugins:\n  ${plugins.join('\n  ')}` };
    }

    case '/reload-plugins':
      return { handled: true, output: await ctx.reloadPlugins() };

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
