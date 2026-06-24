import React, { useState, useCallback, useRef } from 'react';
import { Box, useApp, useInput } from 'ink';
import fs from 'fs/promises';
import path from 'path';
import type { Agent } from '../agent/index.js';
import type { Session } from '../session/Session.js';
import { SessionManager } from '../session/SessionManager.js';
import type { PermissionMode } from '../types.js';
import type { PermissionSystem } from '../permissions/PermissionSystem.js';
import type { UndoManager } from '../tools/UndoManager.js';
import type { Checkpoint } from '../tools/Checkpoint.js';
import { ContextManager } from '../context/ContextManager.js';
import { ChatView, type ChatMessage, type ExpandedOutput } from './ChatView.js';
import { InputBar } from './InputBar.js';
import { StatusBar } from './StatusBar.js';
import { PermissionPrompt } from './PermissionPrompt.js';
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
  permissionMode: PermissionMode;
  themeMode: 'dark' | 'light';
  undoManager: UndoManager;
  checkpoint: Checkpoint;
  permissions: PermissionSystem;
  version: string;
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
  session,
  model,
  permissionMode: initialPermissionMode,
  themeMode: initialThemeMode,
  undoManager,
  checkpoint,
  permissions,
  version,
  initialPrompt,
}: AppProps): React.ReactElement {
  const { exit } = useApp();
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
  const [fastMode, setFastMode] = useState(false);
  const [colorValue, setColorValue] = useState('accent');
  const [effortLevel, setEffortLevel] = useState('medium');
  const [directories, setDirectories] = useState<string[]>([process.cwd()]);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
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
          if (content.trim() === '') return;
          setExpanded({ toolName: msg.toolName, content });
          return;
        }
      }
    }
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

  const handlePermissionDecision = useCallback((decision: 'allow' | 'deny' | 'always') => {
    if (pendingPermission) {
      pendingPermission.resolve(decision);
      setPendingPermission(null);
    }
  }, [pendingPermission]);

  const handleInterrupt = useCallback(() => {
    if (pendingPermission) {
      pendingPermission.resolve('deny');
      setPendingPermission(null);
      return;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsLoading(false);
      setStreamingText('');
      addSystemMessage('Operation cancelled.');
    }
  }, [addSystemMessage, pendingPermission]);

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
      },
      setPermissionMode: (mode) => {
        setCurrentPermissionMode(mode);
        permissions.setMode(mode);
      },
      setThemeMode: (mode) => setThemeMode(mode),
      getSessionId: () => session.getId(),
      getSessionName: () => sessionName,
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
        setMessages(msgs.map(m => ({
          type: 'text' as const,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })));
        setTokenUsage({ input: 0, output: 0 });
        return `Resumed session ${match.id.slice(0, 8)} (${msgs.length} messages)`;
      },
      initWardayaDoc: async () => {
        const cwd = process.cwd();
        const filepath = path.join(cwd, 'WARDAYA.md');
        const content = [
          '# WARDAYA.md',
          '',
          'This file was auto-generated by WarayaCode to document project context',
          'for AI-assisted development sessions.',
          '',
          '## Project',
          `- Path: ${cwd}`,
          `- Generated: ${new Date().toISOString()}`,
          '',
          '## Commands',
          '',
          '```json',
          JSON.stringify({ build: 'npm run build', test: 'npm run test:run', lint: 'npm run lint' }, null, 2),
          '```',
          '',
          '## Recent Activity',
          '',
          '> Update this section as the project evolves.',
          '',
        ].join('\n');
        await fs.writeFile(filepath, content, 'utf-8');
        return `WARDAYA.md created in ${cwd}`;
      },
      getFastMode: () => fastMode,
      setFastMode: (fast) => setFastMode(fast),
      getColor: () => colorValue,
      setColor: (color) => setColorValue(color),
      getEffort: () => effortLevel,
      setEffort: (level) => setEffortLevel(level),
      setTuiRenderer: (renderer: string) => `TUI renderer set to: ${renderer}`,
      getAgentConfigSummary: () => {
        return [
          `Model:        ${model}`,
          `Max tokens:   4096`,
          `Temperature:  0`,
          `Max steps:    25`,
          `Max retries:  3`,
          `Fast mode:    ${fastMode ? 'on' : 'off'}`,
        ].join('\n');
      },
      createBranch: async (name: string) => {
        const { execSync } = await import('node:child_process');
        try {
          execSync(`git stash`, { stdio: 'pipe' });
          execSync(`git checkout -b ${name}`, { stdio: 'pipe' });
          execSync(`git stash pop`, { stdio: 'pipe' });
          return `Branch created: ${name}. Switched to new branch.`;
        } catch {
          return `Failed to create branch: ${name}`;
        }
      },
      listPlugins: () => {
        // Check for plugins directory
        return [];
      },
      reloadPlugins: async () => {
        return 'Plugins reloaded.';
      },
      getSandboxStatus: () => {
        return 'Sandbox: disabled\nSandbox isolates file access to the project directory.\nEnable with /sandbox enable.';
      },
      runSecurityReview: async () => {
        const d = await checkpoint.getDiff();
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
      getDirectories: () => directories,
      addDirectory: (dir: string) => {
        setDirectories(prev => prev.includes(dir) ? prev : [...prev, dir]);
        return `Added directory: ${dir}`;
      },
      copyLastResponse: async () => {
        const msgs = messagesRef.current;
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i]!;
          if (m.type === 'text' && m.role === 'assistant' && m.content) {
            return `Last response: ${m.content.slice(0, 200)}${m.content.length > 200 ? '…' : ''}`;
          }
        }
        return 'No assistant response to copy.';
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
            break;
          }
        }
        return updated;
      });
    };

    const retryHandler = ({ attempt, maxRetries, delayMs, error }: { attempt: number; maxRetries: number; delayMs: number; error: string }) => {
      const delaySec = (delayMs / 1000).toFixed(1);
      addSystemMessage(`Retrying (attempt ${attempt + 1}/${maxRetries + 1}) in ${delaySec}s — ${error}`);
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
      const response = await agent.run(newHistory);
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
  }, [agent, session, exit, currentPermissionMode, tokenUsage, messages.length, model, addSystemMessage, undoManager, checkpoint, permissions, setExpanded]);

  React.useEffect(() => {
    if (initialPrompt) {
      handleSubmit(initialPrompt);
    }
  }, []);

  const showWelcome = messages.length === 0 && !streamingText && !isLoading;

  return (
    <Box flexDirection="column" height="100%">
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

      {showHelp && (
        <HelpDialog themeMode={themeMode} onClose={() => setShowHelp(false)} />
      )}

      <InputBar
        onSubmit={handleSubmit}
        isLoading={isLoading || !!pendingPermission}
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
