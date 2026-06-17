import React from 'react';
import { Box, Text } from 'ink';
import { inkColors } from './theme.js';
import { ToolCallView } from './ToolCallView.js';

interface ToolCallMessage {
  type: 'tool_call';
  toolName: string;
  args: Record<string, unknown>;
  result?: { success: boolean; content?: string; error?: string };
}

interface TextMessage {
  type: 'text';
  role: 'user' | 'assistant';
  content: string;
}

export type ChatMessage = TextMessage | ToolCallMessage;

interface ChatViewProps {
  messages: ChatMessage[];
  streamingText: string;
  themeMode: 'dark' | 'light';
}

export function ChatView({
  messages,
  streamingText,
  themeMode,
}: ChatViewProps): React.ReactElement {
  const colors = inkColors[themeMode];
  const isDark = themeMode === 'dark';
  const userLabel = isDark ? '#E0E0E0' : '#1E1B4B';
  const assistantLabel = isDark ? '#A78BFA' : '#6D28D9';

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {messages.map((msg, idx) => {
        if (msg.type === 'tool_call') {
          return (
            <ToolCallView
              key={idx}
              toolName={msg.toolName}
              args={msg.args}
              result={msg.result}
              themeMode={themeMode}
            />
          );
        }

        const isUser = msg.role === 'user';

        return (
          <Box key={idx} flexDirection="column" marginBottom={1}>
            <Text color={isUser ? userLabel : assistantLabel} bold dimColor>
              {isUser ? 'you' : 'wardayacode'}
            </Text>
            <Box marginLeft={1}>
              <Text color={isUser ? colors.user : colors.assistant} wrap="wrap">
                {msg.content}
              </Text>
            </Box>
          </Box>
        );
      })}

      {streamingText.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={assistantLabel} bold dimColor>wardayacode</Text>
          <Box marginLeft={1}>
            <Text color={colors.assistant} wrap="wrap">
              {streamingText}
              <Text color={colors.accent}>▍</Text>
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
