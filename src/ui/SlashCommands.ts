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

export interface SlashCommandContext {
  clearMessages: () => void;
  setPermissionMode: (mode: PermissionMode) => void;
  setThemeMode: (mode: 'dark' | 'light') => void;
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
  exportSession: () => Promise<string>;
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
