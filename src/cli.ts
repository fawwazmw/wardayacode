#!/usr/bin/env node

import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import chalk from 'chalk';
import { createInterface } from 'node:readline/promises';
import {
  loadConfig,
  setProviderApiKey,
  clearProviderApiKey,
  listProviderAuthStatus,
  isAuthProvider,
  getProviderEnvVarName,
} from './config/index.js';
import { logger } from './utils/logger.js';
import { createProvider } from './providers/index.js';
import { ToolRegistry, registerCoreTools, UndoManager } from './tools/index.js';
import { PermissionSystem } from './permissions/PermissionSystem.js';
import { Agent } from './agent/index.js';
import { buildSystemPrompt } from './agent/systemPrompt.js';
import { Session } from './session/Session.js';
import { SessionManager } from './session/SessionManager.js';
import { Checkpoint } from './tools/Checkpoint.js';
import { App } from './ui/App.js';
import { ErrorBoundary } from './ui/components/ErrorBoundary.js';
import { getCurrentVersion } from './utils/version.js';
import { checkForUpdates } from './utils/updateCheck.js';
import type { PermissionMode, ProviderName } from './types.js';

const program = new Command();

program
  .name('wardayacode')
  .description('AI-powered coding agent for the terminal')
  .version(getCurrentVersion());

// ─── Main command ─────────────────────────────────────────────────────────────

program
  .option('-m, --model <model>', 'Model to use (e.g. claude-sonnet-4-20250514, gpt-4o)')
  .option('-p, --provider <provider>', 'Provider: anthropic, openai, google')
  .option('--mode <mode>', 'Permission mode: default, plan, acceptEdits, auto, internal')
  .option('--no-tui', 'Disable TUI (plain text mode)')
  .option('--resume <sessionId>', 'Resume a previous session')
  .option('-t, --temperature <temp>', 'Temperature (0-1)', parseFloat)
  .option('--max-tokens <tokens>', 'Max tokens per response', parseInt)
  .option('--max-retries <n>', 'Max API call retries (default: 3)', parseInt)
  .option('--system-prompt <prompt>', 'Custom system prompt')
  .option('--debug', 'Enable debug logging (writes to ~/.wardayacode/logs/)')
  .argument('[prompt]', 'Initial prompt to send')
  .action(async (initialPrompt, options) => {
    try {
      await run(initialPrompt, options);
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ─── Sessions subcommand ─────────────────────────────────────────────────────

const sessionsCmd = program
  .command('sessions')
  .description('Manage sessions');

sessionsCmd
  .command('list')
  .alias('ls')
  .description('List all sessions in the current project')
  .action(async () => {
    const manager = new SessionManager(process.cwd());
    const sessions = await manager.list();

    if (sessions.length === 0) {
      console.log(chalk.gray('No sessions found.'));
      return;
    }

    console.log(chalk.bold(`\n  Sessions (${sessions.length})\n`));

    for (const s of sessions) {
      const date = s.createdAt.toLocaleDateString();
      const time = s.createdAt.toLocaleTimeString();
      const size = (s.sizeBytes / 1024).toFixed(1);
      const preview = s.firstMessage ? chalk.gray(` — ${s.firstMessage}`) : '';

      console.log(
        `  ${chalk.cyan(s.id.slice(0, 8))}  ${chalk.gray(date)} ${chalk.gray(time)}  ${chalk.yellow(`${s.messageCount} msgs`)}  ${chalk.gray(`${size}KB`)}${preview}`
      );
    }
    console.log();
  });

sessionsCmd
  .command('delete <sessionId>')
  .alias('rm')
  .description('Delete a session')
  .action(async (sessionId: string) => {
    const manager = new SessionManager(process.cwd());
    const sessions = await manager.list();

    const match = sessions.find(s => s.id.startsWith(sessionId));
    if (!match) {
      console.error(chalk.red(`Session not found: ${sessionId}`));
      process.exit(1);
    }

    const deleted = await manager.delete(match.id);
    if (deleted) {
      console.log(chalk.green(`Deleted session: ${match.id.slice(0, 8)}`));
    } else {
      console.error(chalk.red('Failed to delete session.'));
      process.exit(1);
    }
  });

// ─── Auth subcommand ─────────────────────────────────────────────────────────

const authCmd = program
  .command('auth')
  .description('Manage provider API keys');

authCmd
  .command('login <provider>')
  .description('Save API key for a provider (openai, anthropic, google)')
  .option('-k, --api-key <apiKey>', 'API key value')
  .action(async (provider: string, options: { apiKey?: string }) => {
    if (!isAuthProvider(provider)) {
      console.error(chalk.red(`Unsupported provider: ${provider}`));
      console.error(chalk.gray('Supported providers: openai, anthropic, google'));
      process.exit(1);
    }

    const apiKey = options.apiKey?.trim() || await promptForApiKey(provider);
    await setProviderApiKey(provider, apiKey);
    console.log(chalk.green(`Saved API key for ${provider}.`));
  });

authCmd
  .command('logout <provider>')
  .description('Remove stored API key for a provider')
  .action(async (provider: string) => {
    if (!isAuthProvider(provider)) {
      console.error(chalk.red(`Unsupported provider: ${provider}`));
      console.error(chalk.gray('Supported providers: openai, anthropic, google'));
      process.exit(1);
    }

    const removed = await clearProviderApiKey(provider);
    if (removed) {
      console.log(chalk.green(`Removed stored API key for ${provider}.`));
    } else {
      console.log(chalk.gray(`No stored API key for ${provider}.`));
    }
  });

authCmd
  .command('list')
  .description('List provider auth status')
  .action(async () => {
    const status = await listProviderAuthStatus();

    console.log(chalk.bold('\n  Provider auth status\n'));
    for (const entry of status) {
      const indicator = entry.configured ? chalk.green('configured') : chalk.gray('not configured');
      const source = entry.source === 'none' ? '' : chalk.gray(` (${entry.source})`);
      const envVar = chalk.gray(` env: ${getProviderEnvVarName(entry.provider)}`);
      console.log(`  ${chalk.cyan(entry.provider.padEnd(10))} ${indicator}${source}${envVar}`);
    }
    console.log();
  });

// ─── Core logic ───────────────────────────────────────────────────────────────

interface CLIOptions {
  model?: string;
  provider?: string;
  mode?: string;
  tui?: boolean;
  resume?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  systemPrompt?: string;
  debug?: boolean;
}

async function run(initialPrompt: string | undefined, options: CLIOptions): Promise<void> {
  if (options.debug) {
    logger.setDebug(true);
    logger.debug('debug mode enabled', { logDir: logger.getLogDir() });
  }

  const config = await loadConfig({
    ...(options.model ? { model: options.model } : {}),
    ...(options.provider ? { provider: options.provider as ProviderName } : {}),
    ...(options.mode ? { permissionMode: options.mode as PermissionMode } : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
    ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
  });

  const model = createProvider({
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    apiKeys: config.apiKeys,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });

  const undoManager = new UndoManager();
  const toolRegistry = new ToolRegistry();
  registerCoreTools(toolRegistry, undoManager);

  const permissions = new PermissionSystem(config.permissionMode);

  const projectRoot = process.cwd();
  const systemPrompt = options.systemPrompt ?? config.systemPrompt ?? await buildSystemPrompt(projectRoot);

  const agent = new Agent({
    model,
    toolRegistry,
    permissions,
    systemPrompt,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    maxRetries: config.maxRetries,
  });

  const checkpoint = new Checkpoint(projectRoot);

  const session = options.resume
    ? await loadSession(options.resume, projectRoot, config.permissionMode)
    : await Session.create(projectRoot, config.permissionMode);

  logger.init(session.getId());
  process.on('exit', () => logger.close());

  const currentVersion = getCurrentVersion();

  if (options.tui !== false) {
    runTUI(agent, session, config, undoManager, checkpoint, permissions, currentVersion, initialPrompt);
  } else {
    await runPlainText(agent, session, permissions, currentVersion, initialPrompt);
  }
}

function runTUI(
  agent: Agent,
  session: Session,
  config: { model: string; permissionMode: PermissionMode; theme: 'dark' | 'light' },
  undoManager: UndoManager,
  checkpoint: Checkpoint,
  permissions: PermissionSystem,
  version: string,
  initialPrompt?: string
): void {
  const { waitUntilExit } = render(
    React.createElement(
      ErrorBoundary,
      null,
      React.createElement(App, {
        agent,
        session,
        model: config.model,
        permissionMode: config.permissionMode,
        themeMode: config.theme,
        undoManager,
        checkpoint,
        permissions,
        version,
        initialPrompt,
      })
    )
  );

  waitUntilExit().then(() => {
    process.exit(0);
  });
}

async function runPlainText(
  agent: Agent,
  session: Session,
  permissions: PermissionSystem,
  version: string,
  initialPrompt?: string
): Promise<void> {
  if (!initialPrompt) {
    console.error(chalk.red('Error: prompt required in --no-tui mode'));
    console.error('Usage: wardayacode --no-tui "your prompt here"');
    process.exit(1);
  }

  const update = await checkForUpdates(version);
  if (update?.updateAvailable) {
    console.error(
      chalk.yellow(`\nUpdate available: ${update.current} → ${update.latest}`) +
        chalk.gray('\nRun: npm i -g wardayacode@latest\n')
    );
  }

  let interrupted = false;

  process.on('SIGINT', () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    console.error(chalk.yellow('\nInterrupted. Press Ctrl+C again to force exit.'));
  });

  process.on('SIGTERM', () => {
    console.error(chalk.yellow('\nTerminated.'));
    process.exit(0);
  });

  // In plain text mode, auto-approve all tools (no interactive prompt available)
  permissions.setMode('auto');

  await session.append({
    id: crypto.randomUUID(),
    role: 'user',
    content: initialPrompt,
  });

  agent.on('text-delta', (delta) => {
    process.stdout.write(delta);
  });

  agent.on('tool-call-start', ({ toolName, args }) => {
    const argPreview = JSON.stringify(args).slice(0, 100);
    console.error(chalk.yellow(`\n● ${toolName}`) + chalk.gray(`(${argPreview})`));
  });

  agent.on('tool-call-result', ({ toolName, result }) => {
    const icon = result.success ? chalk.green('✓') : chalk.red('✗');
    const preview = result.content?.slice(0, 100) ?? result.error ?? '';
    console.error(`${icon} ${chalk.bold(toolName)}: ${chalk.gray(preview)}`);
  });

  agent.on('error', (error) => {
    console.error(chalk.red(`\n✗ Error: ${error.message}`));
  });

  try {
    const response = await agent.run([{ role: 'user', content: initialPrompt }]);

    await session.append({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response,
    });

    process.stdout.write('\n');
  } catch (error) {
    console.error(chalk.red('\nAgent error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function loadSession(
  sessionId: string,
  projectRoot: string,
  mode: PermissionMode
): Promise<Session> {
  const manager = new SessionManager(projectRoot);
  const sessions = await manager.list();
  const match = sessions.find(s => s.id.startsWith(sessionId));

  if (!match) {
    console.error(chalk.red(`Session not found: ${sessionId}`));
    console.error(chalk.gray('Run "wardayacode sessions list" to see available sessions.'));
    process.exit(1);
  }

  const session = new Session(match.id, projectRoot, mode);
  await session.load();
  return session;
}

async function promptForApiKey(provider: ProviderName): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const prompt = `Enter ${provider} API key (or set ${getProviderEnvVarName(provider)}): `;
    const value = (await rl.question(prompt)).trim();
    if (!value) {
      throw new Error('API key cannot be empty');
    }
    return value;
  } finally {
    rl.close();
  }
}

program.parse();
