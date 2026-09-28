import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { streamText, type LanguageModel } from 'ai';
import type { Agent } from '../agent/index.js';
import type { Session } from '../session/Session.js';
import { SessionManager } from '../session/SessionManager.js';
import type { PermissionMode } from '../types.js';
import type { PermissionSystem } from '../permissions/PermissionSystem.js';
import type { UndoManager } from '../tools/UndoManager.js';
import type { Checkpoint } from '../tools/Checkpoint.js';
import type { McpManager } from '../mcp/McpManager.js';
import { ContextManager } from '../context/ContextManager.js';
import { ChatView, type ChatMessage, type ExpandedOutput } from './ChatView.js';
import { InputBar } from './InputBar.js';
import { StatusBar } from './StatusBar.js';
import { PermissionPrompt } from './PermissionPrompt.js';
import { inkColors } from './theme.js';
import { handleSlashCommand } from './SlashCommands.js';
import { HelpDialog } from './HelpDialog.js';
import { WelcomeScreen } from './components/WelcomeScreen.js';
import { checkForUpdates, type UpdateInfo } from '../utils/updateCheck.js';
import {
  clearProviderApiKey,
  isAuthProvider,
  listProviderAuthStatus,
  setProviderApiKey,
} from '../config/index.js';

interface AppProps {
  agent: Agent;
  session: Session;
  model: string;
  languageModel?: LanguageModel;
  permissionMode: PermissionMode;
  themeMode: 'dark' | 'light';
  undoManager: UndoManager;
  checkpoint: Checkpoint;
  permissions: PermissionSystem;
  mcpManager?: McpManager;
  version: string;
  /** Human-readable hook status for /hooks. */
  hooksInfo: () => Promise<string>;
  /** Trust the current project's hooks and activate them. */
  trustHooks: () => Promise<string>;
  maxTokens: number;
  temperature: number;
  maxRetries: number;
  maxSteps: number;
  initialPrompt?: string;
}

interface PendingPermission {
  toolName: string;
  args: Record<string, unknown>;
  reason: string;
  resolve: (decision: 'allow' | 'deny' | 'always') => void;
}

export function App({
  agent,
  session: initialSession,
  model,
  languageModel,
  permissionMode: initialPermissionMode,
  themeMode: initialThemeMode,
  undoManager,
  checkpoint,
  permissions,
  mcpManager,
  version,
  hooksInfo,
  trustHooks,
  maxTokens,
  temperature,
  maxRetries,
  maxSteps,
  initialPrompt,
}: AppProps): React.ReactElement {
  const { exit } = useApp();
  // The active session can be swapped at runtime by /resume, so it lives in
  // state rather than being read straight from props.
  const [session, setSession] = useState<Session>(initialSession);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0 });
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const contextManagerRef = useRef<ContextManager>(new ContextManager(process.cwd()));
  const sessionStartRef = useRef(Date.now());
  const [currentPermissionMode, setCurrentPermissionMode] = useState<PermissionMode>(initialPermissionMode);
  const [themeMode, setThemeMode] = useState(initialThemeMode);
  const [sessionName, setSessionName] = useState('');
  const [effortLevel, setEffortLevel] = useState('medium');
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [pendingMcp, setPendingMcp] = useState<{ name: string; command: string; resolve: (ok: boolean) => void } | null>(null);
  const sessionNameRef = useRef(sessionName);
  sessionNameRef.current = sessionName;
  const effortLevelRef = useRef(effortLevel);
  effortLevelRef.current = effortLevel;
  const abortRef = useRef<AbortController | null>(null);

  // Full output of the most-recent tool call, toggled by ctrl+o. It renders in
  // the live region (ChatView's dynamic tail), not <Static>, so it can be
  // collapsed back to the "+N lines" preview — committed scrollback can't.
  const [expandedOutput, setExpandedOutput] = useState<ExpandedOutput | null>(null);
  // Ink's useInput keeps the handler closure from the first render, so reads
  // inside it must go through refs to see the latest values.
  const expandedOutputRef = useRef<ExpandedOutput | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  const setExpanded = useCallback((value: ExpandedOutput | null) => {
    expandedOutputRef.current = value;
    setExpandedOutput(value);
  }, []);

  // Ctrl+O toggles the latest tool call's full output on/off.
  useInput((input, key) => {
    if (showHelp) return;
    if (key.ctrl && input === 'o') {
      if (expandedOutputRef.current) {
        setExpanded(null);
        return;
      }
      const msgs = messagesRef.current;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i]!;
        if (msg.type === 'tool_call' && msg.result) {
          const content = msg.result.success
            ? msg.result.content ?? ''
            : msg.result.error ?? msg.result.content ?? '';
          if (content.trim() === '') continue;
          setExpanded({ toolName: msg.toolName, content });
          return;
        }
      }
    }
  });

  // Answers the MCP connect confirmation prompt. Gated on pendingMcp so it
  // never swallows typing while no confirmation is active.
  useInput((input) => {
    if (!pendingMcp) return;
    if (input === 'y' || input === 'Y') handleMcpDecision(true);
    if (input === 'n' || input === 'N') handleMcpDecision(false);
  });

  const addSystemMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { type: 'text', role: 'assistant', content: `ℹ ${content}` }]);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    checkForUpdates(version)
      .then((info) => {
        if (!cancelled) setUpdateInfo(info);
      })
      .catch(() => {
        /* update check failures are non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  React.useEffect(() => {
    permissions.setPromptHandler(async (toolName, args, reason) => {
      return new Promise<'allow' | 'deny' | 'always'>((resolve) => {
        setPendingPermission({ toolName, args, reason, resolve });
      });
    });
  }, [permissions]);

  // Seed the transcript and agent context from an existing session when the
  // process was launched with --resume (the in-session /resume path seeds its
  // own state, but startup resume previously showed an empty conversation).
  React.useEffect(() => {
    const existing = initialSession.getMessages();
    if (existing.length === 0) return;

    const ctx = contextManagerRef.current;
    ctx.clear();
    for (const m of existing) {
      if (m.role === 'user' || m.role === 'assistant') {
        ctx.addMessage({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp });
      }
    }

    setMessages(
      existing.map(m => ({
        type: 'text' as const,
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    );
  }, [initialSession]);

  const handlePermissionDecision = useCallback((decision: 'allow' | 'deny' | 'always') => {
    if (pendingPermission) {
      pendingPermission.resolve(decision);
      setPendingPermission(null);
    }
  }, [pendingPermission]);

  const handleMcpDecision = useCallback((ok: boolean) => {
    if (pendingMcp) {
      pendingMcp.resolve(ok);
      setPendingMcp(null);
    }
  }, [pendingMcp]);

  const handleInterrupt = useCallback(() => {
    if (pendingPermission) {
      pendingPermission.resolve('deny');
      setPendingPermission(null);
      return;
    }
    if (pendingMcp) {
      pendingMcp.resolve(false);
      setPendingMcp(null);
      return;
    }
    if (abortRef.current) {
      // Abort the in-flight request; the run's catch/finally surfaces the
      // cancellation and clears loading state. Do NOT flip isLoading here, or
      // a new prompt could start a second concurrent run.
      abortRef.current.abort();
    }
  }, [pendingPermission, pendingMcp]);

  const handleSubmit = useCallback(async (text: string) => {
    const trimmed = text.trim();
    const parts = trimmed.split(/\s+/);
    const command = parts[0]?.toLowerCase();

    if (command === '/help' || command === '/h') {
      setShowHelp(true);
      return;
    }

    if (command === '/login') {
      const provider = parts[1];
      const apiKey = parts.slice(2).join(' ').trim();

      if (!provider || !apiKey) {
        addSystemMessage('Usage: /login <provider> <apiKey>\nProviders: openai, anthropic, google');
        return;
      }

      if (!isAuthProvider(provider)) {
        addSystemMessage(`Unsupported provider: ${provider}\nProviders: openai, anthropic, google`);
        return;
      }

      try {
        await setProviderApiKey(provider, apiKey);
        addSystemMessage(`Saved API key for ${provider}.`);
      } catch (error) {
        addSystemMessage(`Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      return;
    }

    if (command === '/logout') {
      const provider = parts[1];

      if (!provider) {
        addSystemMessage('Usage: /logout <provider>\nProviders: openai, anthropic, google');
        return;
      }

      if (!isAuthProvider(provider)) {
        addSystemMessage(`Unsupported provider: ${provider}\nProviders: openai, anthropic, google`);
        return;
      }

      const removed = await clearProviderApiKey(provider);
      addSystemMessage(removed ? `Removed stored API key for ${provider}.` : `No stored API key for ${provider}.`);
      return;
    }

    if (command === '/auth') {
      const status = await listProviderAuthStatus();
      const lines = status.map(entry => {
        const source = entry.source === 'none' ? 'not configured' : `configured (${entry.source})`;
        return `${entry.provider}: ${source}`;
      });
      addSystemMessage(lines.join('\n'));
      return;
    }

    const cmdResult = await handleSlashCommand(text, {
      clearMessages: () => {
        setMessages([]);
        setExpanded(null);
        // Actually drop the conversation context too — otherwise the next
        // prompt still carries every "cleared" turn to the model.
        contextManagerRef.current.clear();
        setTokenUsage({ input: 0, output: 0 });
      },
      setPermissionMode: (mode) => {
        setCurrentPermissionMode(mode);
        permissions.setMode(mode);
      },
      setThemeMode: (mode) => setThemeMode(mode),
      getSessionId: () => session.getId(),
      getSessionName: () => sessionNameRef.current,
      setSessionName: (name) => setSessionName(name),
      getModel: () => model,
      getVersion: () => version,
      getPermissionMode: () => currentPermissionMode,
      getTokenUsage: () => tokenUsage,
      getSessionDuration: () => Date.now() - sessionStartRef.current,
      getMessageCount: () => messages.length,
      getContextStats: () => {
        const ctx = contextManagerRef.current;
        const msgs = ctx.getMessages();
        // Rough token estimate matching ContextManager.estimateTokens
        const estimatedTokens = msgs.reduce((sum, m) => sum + Math.ceil(m.content.length * 0.4) + 4, 0);
        return {
          messageCount: msgs.length,
          estimatedTokens,
          shouldCompact: ctx.shouldCompact(),
        };
      },
      exportSession: async () => {
        const content = await session.export();
        const cwd = process.cwd();
        const filename = `wardayacode-export-${session.getId().slice(0, 8)}.md`;
        const filepath = path.join(cwd, filename);
        await fs.writeFile(filepath, content, 'utf-8');
        return `Conversation exported to ${filename}`;
      },
      listSessions: async () => {
        const mgr = new SessionManager(process.cwd());
        const list = await mgr.list();
        return list.map(s => ({ id: s.id, createdAt: s.createdAt, messageCount: s.messageCount, firstMessage: s.firstMessage }));
      },
      resumeSession: async (sessionId: string) => {
        const { Session: SessionClass } = await import('../session/Session.js');
        const mgr = new SessionManager(process.cwd());
        const sessions = await mgr.list();
        const match = sessions.find(s => s.id.startsWith(sessionId));
        if (!match) return `No session found matching "${sessionId}".`;
        const loaded = new SessionClass(match.id, process.cwd(), currentPermissionMode);
        await loaded.load();
        const msgs = loaded.getMessages();

        // Rebuild the live context so the agent actually carries the resumed
        // history into the next turn — previously this was display-only and the
        // next prompt was sent with no prior turns.
        const ctx = contextManagerRef.current;
        ctx.clear();
        for (const m of msgs) {
          if (m.role === 'user' || m.role === 'assistant') {
            ctx.addMessage({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
            });
          }
        }

        // Swap the active session so subsequent appends land in the resumed
        // transcript rather than the session that was open at startup.
        setSession(loaded);
        setMessages(msgs.map(m => ({
          type: 'text' as const,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })));
        setTokenUsage({ input: 0, output: 0 });
        sessionStartRef.current = Date.now();
        return `Resumed session ${match.id.slice(0, 8)} (${msgs.length} messages)`;
      },
      initWardayaDoc: async () => {
        const cwd = process.cwd();
        const filepath = path.join(cwd, 'WARDAYA.md');
        // Discover project commands from package.json
        const commands: Record<string, string> = {};
        try {
          const pkgPath = path.join(cwd, 'package.json');
          if (existsSync(pkgPath)) {
            const pkgStr = await fs.readFile(pkgPath, 'utf-8');
            const pkg = JSON.parse(pkgStr) as Record<string, unknown>;
            const scripts = pkg.scripts as Record<string, string> | undefined;
            if (scripts) {
              // Pick the most relevant scripts for the doc
              for (const key of ['dev', 'start', 'build', 'test', 'test:run', 'lint', 'type-check', 'format']) {
                if (scripts[key]) commands[key] = scripts[key]!;
              }
            }
            // Detect test runner from devDependencies
            const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
            if (deps.vitest && !commands['test:run']) commands['test:run'] = 'vitest run';
            if (deps.jest && !commands['test']) commands['test'] = 'jest';
          }
        } catch { /* not a Node project */ }

        // Check for Python/Rust/Go project indicators
        let testHint = '';
        if (!commands['test']) {
          for (const f of ['pyproject.toml', 'Cargo.toml', 'go.mod']) {
            if (existsSync(path.join(cwd, f))) testHint = `\n## Testing\n\nRefer to ${f} for test commands.`;
          }
        }

        const commandBlock = Object.keys(commands).length > 0
          ? JSON.stringify(commands, null, 2)
          : 'Refer to your project for available commands.';

        const content = [
          '# WARDAYA.md',
          '',
          'This file was auto-generated by WardayaCode to document project context',
          'for AI-assisted development sessions.',
          '',
          '## Project',
          `- Path: ${cwd}`,
          `- Generated: ${new Date().toISOString()}`,
          '',
          '## Commands',
          '',
          '```json',
          commandBlock,
          '```',
          testHint,
          '',
          '## Recent Activity',
          '',
          '> Update this section as the project evolves.',
          '',
        ].join('\n');
        await fs.writeFile(filepath, content, 'utf-8');
        return `WARDAYA.md created in ${cwd}`;
      },
      getEffort: () => effortLevelRef.current,
      setEffort: (level) => {
        setEffortLevel(level);
        if ('setEffort' in agent) {
          (agent as unknown as { setEffort: (l: string) => void }).setEffort(level);
        }
      },
      setTuiRenderer: (renderer: string) => {
        return `TUI renderer "${renderer}" is not available. Ink's render() only supports the default terminal renderer.`;
      },
      getAgentConfigSummary: () => {
        return [
          `Model:        ${model}`,
          `Permission:   ${currentPermissionMode}`,
          `Effort:       ${effortLevelRef.current}`,
          `Max tokens:   ${maxTokens}`,
          `Temperature:  ${temperature}`,
          `Max steps:    ${maxSteps}`,
          `Max retries:  ${maxRetries}`,
        ].join('\n');
      },
      createBranch: async (name: string) => {
        const { execSync } = await import('node:child_process');
        try {
          // Check it's a git repo first
          execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' });
        } catch {
          return `Not a git repository. Cannot create branch.`;
        }
        try {
          // Stash any uncommitted changes first
          execSync('git stash --include-untracked', { stdio: 'pipe' });
          execSync(`git checkout -b ${name}`, { stdio: 'pipe' });
          // Pop the stash, but don't fail if it was empty
          try { execSync('git stash pop', { stdio: 'pipe' }); } catch { /* no stash to pop */ }
          return `Branch created: ${name}. Switched to new branch.`;
        } catch {
          return `Failed to create branch: ${name}.`;
        }
      },
      mcpList: async () => {
        if (!mcpManager) return 'MCP not available in this context.';
        const names = mcpManager.getConfigNames();
        if (names.length === 0) {
          return 'No MCP servers configured.\nAdd .mcp.json or .wardayacode/mcp/*.json.';
        }
        return `Configured MCP servers:\n  ${names.join('\n  ')}\nUse /mcp connect <name> to connect.`;
      },
      mcpConnect: async (name: string) => {
        if (!mcpManager) return 'MCP not available in this context.';
        const command = mcpManager.getServerCommand(name);
        if (command === undefined) return `Unknown MCP server: ${name}`;
        const status = mcpManager.getStatus().find(s => s.name === name);
        if (status?.status === 'connected') return `Server "${name}" is already connected.`;

        // Security gate: MCP configs (`.mcp.json` / `.wardayacode/mcp/*.json`)
        // can come from a cloned repo, so never spawn a server process without
        // surfacing the exact command and getting explicit approval.
        const approved = await new Promise<boolean>(resolve => {
          setPendingMcp({ name, command, resolve });
        });
        if (!approved) return 'MCP connect cancelled.';
        return mcpManager.connect(name);
      },
      mcpDisconnect: async (name: string) => {
        if (!mcpManager) return 'MCP not available in this context.';
        return mcpManager.disconnect(name);
      },
      mcpStatus: async () => {
        if (!mcpManager) return 'MCP not available in this context.';
        const statuses = mcpManager.getStatus();
        if (statuses.length === 0) return 'No MCP servers configured.';
        const lines = statuses.map(s =>
          `  ${s.name.padEnd(20)} ${s.status === 'connected' ? '✓ connected' : '— disconnected'} (${s.toolCount} tools)`,
        );
        return `MCP servers:\n${lines.join('\n')}`;
      },
      getHooksInfo: () => hooksInfo(),
      trustHooks: () => trustHooks(),
      getSandboxEnabled: () => permissions.isSandboxEnabled(),
      setSandboxEnabled: (enabled: boolean) => {
        // Sandbox is a first-class gate in PermissionSystem, independent of the
        // permission mode, so /mode changes can't silently drop it.
        permissions.setSandbox(enabled);
      },
      runSecurityReview: async () => {
        const d = await checkpoint.getDiffSummary();
        if (!d) return 'No changes to review.';
        const lines = d.split('\n');
        const addedLines = lines.filter(l => l.startsWith('+') && !l.startsWith('+++'));
        const sensitive = addedLines.filter(l =>
          /api.?key|secret|token|password|credential|\.env/i.test(l)
        );
        const output = [`Security review of ${lines.filter(l => l.startsWith('diff')).length} file(s):`];
        if (sensitive.length > 0) {
          output.push(`⚠ ${sensitive.length} potential secret(s) found in diff:`);
          for (const s of sensitive.slice(0, 10)) {
            output.push(`  ${s.slice(0, 80)}`);
          }
        } else {
          output.push('✓ No potential secrets detected in pending changes.');
        }
        output.push(`\nFull diff: ${lines.length} lines`);
        return output.join('\n');
      },
      copyLastResponse: async () => {
        const msgs = messagesRef.current;
        // Find the last assistant text response
        let found = '';
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i]!;
          if (m.type === 'text' && m.role === 'assistant' && m.content) {
            found = m.content;
            break;
          }
        }
        if (!found) return 'No assistant response to copy.';

        // Copy to clipboard using platform-appropriate command.
        // Pipe via stdin (execSync input) rather than echo + shell pipe to
        // avoid shell interpretation of metacharacters in the content.
        const { execSync } = await import('node:child_process');
        let copied = false;
        try {
          if (process.platform === 'darwin') {
            execSync('pbcopy', { input: found });
            copied = true;
          } else if (process.platform === 'win32') {
            execSync('clip', { input: found });
            copied = true;
          } else {
            // Linux: try xclip, fall back to xsel
            try {
              execSync('xclip -selection clipboard', { input: found });
              copied = true;
            } catch {
              execSync('xsel -b', { input: found });
              copied = true;
            }
          }
        } catch {
          // clipboard unavailable — fall back to showing the text
        }
        if (copied) {
          const preview = found.slice(0, 80);
          return `Copied assistant response to clipboard.\n  "${preview}${found.length > 80 ? '…' : ''}"`;
        }
        return `No clipboard tool found. Last response:\n${found.slice(0, 500)}${found.length > 500 ? '…' : ''}`;
      },
      getConfigSummary: () => {
        return [
          `Model:     ${model}`,
          `Version:   ${version}`,
          `Theme:     ${themeMode}`,
          `Mode:      ${currentPermissionMode}`,
          `Session:   ${session.getId().slice(0, 8)}`,
        ].join('\n');
      },
      openKeybindings: async () => {
        const dir = path.join(process.cwd(), '.wardayacode');
        const filepath = path.join(dir, 'keybindings.json');
        await fs.mkdir(dir, { recursive: true });
        try {
          await fs.access(filepath);
        } catch {
          // Create default keybindings file
          await fs.writeFile(filepath, JSON.stringify({}, null, 2), 'utf-8');
        }
        return `Keybindings file: ${filepath}`;
      },
      exit,
      undo: async () => {
        const result = await undoManager.undo();
        return result ? `Undid ${result.toolName} on ${result.filePath}` : 'Nothing to undo.';
      },
      checkpoint: async () => {
        const created = await checkpoint.createCheckpoint('manual checkpoint');
        return created ? 'Checkpoint created (git stash).' : 'No changes to checkpoint.';
      },
      rollback: async () => {
        const rolled = await checkpoint.rollback();
        return rolled ? 'Rolled back to last checkpoint.' : 'No checkpoint to rollback to.';
      },
      diff: async () => {
        const d = await checkpoint.getDiff();
        return d || 'No uncommitted changes.';
      },
      compact: async () => {
        const ctx = contextManagerRef.current;
        const compacted = await ctx.compact();
        ctx.clear();
        for (const m of compacted.messages) ctx.addMessage(m);
        return `Context compacted: ${compacted.compactionLayers.length} layer(s) applied, ~${compacted.tokenCount.toLocaleString()} tokens remaining.`;
      },
      openUrl: async (url: string) => {
        const { execSync } = await import('node:child_process');
        // Shell-escape the URL: wrap in single quotes and escape any single quotes inside it
        const escaped = `'${url.replace(/'/g, "'\\''")}'`;
        const cmd = process.platform === 'darwin'
          ? `open ${escaped}`
          : process.platform === 'win32'
            ? `start "" ${escaped}`
            : `xdg-open ${escaped}`;
        try {
          execSync(cmd, { stdio: 'ignore' });
          return `Opened in browser: ${url}`;
        } catch {
          return `Open this URL in your browser:\n  ${url}`;
        }
      },
      getProjectRoot: () => process.cwd(),
      getPermissionRules: () => {
        const rules = permissions.getRules();
        const lines = [`Permission mode: ${currentPermissionMode}`, '', 'Rules (first match wins):'];
        if (rules.length === 0) {
          lines.push('  (none)');
        } else {
          for (const r of rules) {
            const pattern = r.pattern ? ` pattern=${r.pattern}` : '';
            const reason = r.reason ? `  — ${r.reason}` : '';
            lines.push(`  ${r.action.toUpperCase().padEnd(5)} ${r.tool}${pattern}${reason}`);
          }
        }
        const allowList = permissions.getSessionAllowList();
        if (allowList.length > 0) {
          lines.push('', `Session allow-list: ${allowList.join(', ')}`);
        }
        lines.push('', 'Change mode with /mode; approvals add to the session allow-list.');
        return lines.join('\n');
      },
      askSideQuestion: async (question: string) => {
        if (!languageModel) {
          return 'Side questions require a LanguageModel instance (not available in this context).';
        }
        try {
          const result = streamText({
            model: languageModel,
            messages: [
              { role: 'system', content: 'Answer the following question concisely. This is a side question from a coding session — be direct and helpful.' },
              { role: 'user', content: question },
            ],
            maxTokens: 512,
            temperature: 0,
          });
          const answer = (await result.text) ?? '';
          return `Side question: "${question}"\n\n${answer}`;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return `Side question failed: ${msg}`;
        }
      },
      listOpenPRs: async () => {
        const { execSync } = await import('node:child_process');
        try {
          execSync('gh --version', { stdio: 'pipe' });
          const output = execSync('gh pr list --limit 10 --json number,title,state,author --jq \'.[] | "#\(.number) \(.title) [\(.state)]"\'', { encoding: 'utf-8', stdio: 'pipe' });
          const prs = output.trim();
          if (!prs) return 'No open pull requests found.';
          return `Open pull requests:\n${prs}`;
        } catch {
          return 'No open pull requests found.\nMake sure gh CLI is installed and authenticated.';
        }
      },
    });

    if (cmdResult.handled) {
      if (cmdResult.output) {
        addSystemMessage(cmdResult.output);
      }
      return;
    }

    setMessages(prev => [...prev, { type: 'text', role: 'user', content: text }]);
    // A stale expansion from the previous turn would otherwise dangle at the
    // bottom of the live region; drop it when a new turn begins.
    setExpanded(null);
    setIsLoading(true);
    setStreamingText('');

    await session.append({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    });

    const ctx = contextManagerRef.current;
    ctx.addCoreMessage('user', text);

    // Compact before sending if we're approaching the token budget
    if (ctx.shouldCompact()) {
      const compacted = await ctx.compact();
      ctx.clear();
      for (const m of compacted.messages) {
        ctx.addMessage(m);
      }
      addSystemMessage(`Context compacted: ${compacted.compactionLayers.length} layer(s) applied, ~${compacted.tokenCount.toLocaleString()} tokens remaining.`);
    }

    const newHistory = ctx.toCoreMessages();
    abortRef.current = new AbortController();

    const textDeltaHandler = (delta: string) => {
      setStreamingText(prev => prev + delta);
    };

    const toolCallStartHandler = ({ toolName, args }: { toolName: string; args: Record<string, unknown> }) => {
      setMessages(prev => [...prev, {
        type: 'tool_call',
        toolName,
        args,
        startedAt: Date.now(),
      }]);
    };

    const toolCallResultHandler = ({ toolName, result }: { toolName: string; result: { success: boolean; content?: string; error?: string } }) => {
      setMessages(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          const msg = updated[i]!;
          if (msg.type === 'tool_call' && msg.toolName === toolName && !msg.result) {
            updated[i] = {
              type: 'tool_call',
              toolName: msg.toolName,
              args: msg.args,
              result,
              startedAt: msg.startedAt,
              durationMs: msg.startedAt !== undefined ? Date.now() - msg.startedAt : undefined,
            };
            return updated;
          }
        }
        // No in-progress call matched: the tool was denied or blocked before it
        // started (permission/hook gate), which emits only a result. Surface it
        // instead of dropping the event silently.
        updated.push({
          type: 'tool_call',
          toolName,
          args: {},
          result,
          startedAt: Date.now(),
          durationMs: 0,
        });
        return updated;
      });
    };

    const retryHandler = ({ attempt, maxRetries, delayMs, error }: { attempt: number; maxRetries: number; delayMs: number; error: string }) => {
      const delaySec = (delayMs / 1000).toFixed(1);
      addSystemMessage(`Retrying (attempt ${attempt}/${maxRetries + 1}) in ${delaySec}s — ${error}`);
    };

    const usageHandler = ({ promptTokens, completionTokens }: { promptTokens: number; completionTokens: number; totalTokens: number }) => {
      setTokenUsage(prev => ({
        input: prev.input + promptTokens,
        output: prev.output + completionTokens,
      }));
    };

    agent.on('text-delta', textDeltaHandler);
    agent.on('tool-call-start', toolCallStartHandler);
    agent.on('tool-call-result', toolCallResultHandler);
    agent.on('retry', retryHandler);
    agent.on('usage', usageHandler);

    const startedAt = Date.now();
    try {
      const response = await agent.run(newHistory, abortRef.current?.signal);
      const durationMs = Date.now() - startedAt;

      setStreamingText('');
      setMessages(prev => [...prev, { type: 'text', role: 'assistant', content: response, durationMs }]);
      ctx.addCoreMessage('assistant', response);

      await session.append({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
      });
    } catch (error) {
      setStreamingText('');
      if ((error as Error).name === 'AbortError') {
        addSystemMessage('Operation cancelled.');
      } else {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setMessages(prev => [...prev, { type: 'text', role: 'assistant', content: `Error: ${errorMsg}` }]);
      }
    } finally {
      agent.off('text-delta', textDeltaHandler);
      agent.off('tool-call-start', toolCallStartHandler);
      agent.off('tool-call-result', toolCallResultHandler);
      agent.off('retry', retryHandler);
      agent.off('usage', usageHandler);
      abortRef.current = null;
      setIsLoading(false);
    }
  }, [agent, session, exit, currentPermissionMode, tokenUsage, messages.length, model, addSystemMessage, undoManager, checkpoint, permissions, mcpManager, setExpanded]);

  React.useEffect(() => {
    if (initialPrompt) {
      handleSubmit(initialPrompt);
    }
  }, []);

  const showWelcome = messages.length === 0 && !streamingText && !isLoading;
  const colors = inkColors[themeMode];

  return (
    <Box flexDirection="column" minHeight="100%">
      <Box flexGrow={1}>
        {showWelcome ? (
          <WelcomeScreen
            model={model}
            permissionMode={currentPermissionMode}
            sessionId={session.getId()}
            cwd={process.cwd()}
            themeMode={themeMode}
            version={version}
            latestVersion={updateInfo?.latest}
            updateAvailable={updateInfo?.updateAvailable ?? false}
          />
        ) : (
          <ChatView
            messages={messages}
            streamingText={streamingText}
            themeMode={themeMode}
            expandedOutput={expandedOutput}
          />
        )}

        {pendingPermission && (
          <PermissionPrompt
            toolName={pendingPermission.toolName}
            args={pendingPermission.args}
            reason={pendingPermission.reason}
            themeMode={themeMode}
            onDecision={handlePermissionDecision}
          />
        )}

        {pendingMcp && (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={colors.accent}
            paddingX={2}
            paddingY={1}
            marginX={1}
          >
            <Text bold>Connect to MCP server "{pendingMcp.name}"?</Text>
            <Text color={colors.muted}>Command: {pendingMcp.command}</Text>
            <Text color={colors.muted}>(y)es / (n)o</Text>
          </Box>
        )}

        {showHelp && (
          <HelpDialog themeMode={themeMode} onClose={() => setShowHelp(false)} />
        )}
      </Box>

      <InputBar
        onSubmit={handleSubmit}
        isLoading={isLoading || !!pendingPermission || !!pendingMcp}
        inputDisabled={showHelp}
        themeMode={themeMode}
        onInterrupt={handleInterrupt}
      />

      <StatusBar
        model={model}
        tokenUsage={tokenUsage}
        permissionMode={currentPermissionMode}
        sessionId={session.getId()}
        themeMode={themeMode}
      />
    </Box>
  );
}
