import React from 'react';
import { Box, Text } from 'ink';
import { inkColors } from './theme.js';
import { ToolCallView } from './ToolCallView.js';
import { formatDuration } from '../utils/formatDuration.js';

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
  /** Wall-clock time the assistant took to produce this answer, in ms. */
  durationMs?: number;
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
  const answerDot = colors.success;

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

        if (msg.role === 'user') {
          // Blocked: inverse strip so the user's message reads as a distinct
          // block, clearly separated from the assistant's answer below it.
          return (
            <Box key={idx} flexDirection="column" marginY={1}>
              <Text color={colors.user} inverse>
                {` ${msg.content} `}
              </Text>
            </Box>
          );
        }

        // System/info notices (emitted via addSystemMessage with an "ℹ "
        // prefix) are not answers — render them dim, without the answer dot.
        if (msg.content.startsWith('ℹ ')) {
          return (
            <Box key={idx} flexDirection="column" marginBottom={1}>
              <Text color={colors.muted} dimColor wrap="wrap">
                {msg.content}
              </Text>
            </Box>
          );
        }

        // Errors are not answers either — mark them with a red dot.
        if (msg.content.startsWith('Error: ')) {
          return (
            <Box key={idx} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color={colors.error}>● </Text>
                <Box flexGrow={1}>
                  <Text color={colors.error} wrap="wrap">
                    {msg.content}
                  </Text>
                </Box>
              </Box>
            </Box>
          );
        }

        // Assistant answer: a filled dot marks the answer (no "wardayacode"
        // label), and the elapsed time is shown once the answer is complete.
        return (
          <Box key={idx} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={answerDot}>● </Text>
              <Box flexDirection="column" flexGrow={1}>
                <Text color={colors.assistant} wrap="wrap">
                  {msg.content}
                </Text>
                {msg.durationMs !== undefined && (
                  <Text color={colors.muted} dimColor>
                    {`Done in ${formatDuration(msg.durationMs)}`}
                  </Text>
                )}
              </Box>
            </Box>
          </Box>
        );
      })}

      {streamingText.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={colors.warning}>✻ </Text>
            <Box flexGrow={1}>
              <Text color={colors.assistant} wrap="wrap">
                {streamingText}
                <Text color={colors.accent}>▍</Text>
              </Text>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
