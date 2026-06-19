import type { PermissionMode } from '../types.js';

export interface SlashCommandEntry {
  name: string;
  description: string;
  args?: string;
}

export const SLASH_COMMANDS: SlashCommandEntry[] = [
  { name: '/help', description: 'Show available commands' },
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
  getSessionId: () => string;
  getModel: () => string;
  getPermissionMode: () => PermissionMode;
  getTokenUsage: () => { input: number; output: number };
  getMessageCount: () => number;
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
