import React, { useState, useCallback, useRef } from 'react';
import { Box, useApp } from 'ink';
import type { Agent } from '../agent/index.js';
import type { Session } from '../session/Session.js';
import type { PermissionMode } from '../types.js';
import type { PermissionSystem } from '../permissions/PermissionSystem.js';
import type { UndoManager } from '../tools/UndoManager.js';
import type { Checkpoint } from '../tools/Checkpoint.js';
import { ContextManager } from '../context/ContextManager.js';
import { ChatView, type ChatMessage } from './ChatView.js';
import { InputBar } from './InputBar.js';
import { StatusBar } from './StatusBar.js';
import { PermissionPrompt } from './PermissionPrompt.js';
import { handleSlashCommand } from './SlashCommands.js';
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
  themeMode,
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
  const contextManagerRef = useRef<ContextManager>(new ContextManager(process.cwd()));
  const [currentPermissionMode, setCurrentPermissionMode] = useState<PermissionMode>(initialPermissionMode);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
      clearMessages: () => setMessages([]),
      setPermissionMode: (mode) => {
        setCurrentPermissionMode(mode);
        permissions.setMode(mode);
      },
      getSessionId: () => session.getId(),
      getModel: () => model,
      getPermissionMode: () => currentPermissionMode,
      getTokenUsage: () => tokenUsage,
      getMessageCount: () => messages.length,
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
      }]);
    };

    const toolCallResultHandler = ({ toolName, result }: { toolName: string; result: { success: boolean; content?: string; error?: string } }) => {
      setMessages(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          const msg = updated[i]!;
          if (msg.type === 'tool_call' && msg.toolName === toolName && !msg.result) {
            updated[i] = { type: 'tool_call', toolName: msg.toolName, args: msg.args, result };
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

    try {
      const response = await agent.run(newHistory);

      setStreamingText('');
      setMessages(prev => [...prev, { type: 'text', role: 'assistant', content: response }]);
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
  }, [agent, session, exit, currentPermissionMode, tokenUsage, messages.length, model, addSystemMessage, undoManager, checkpoint, permissions]);

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

      <InputBar
        onSubmit={handleSubmit}
        isLoading={isLoading || !!pendingPermission}
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
