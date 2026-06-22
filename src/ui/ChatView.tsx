import React, { useRef } from 'react';
import { Box, Static, Text } from 'ink';
import { inkColors } from './theme.js';
import { ToolCallView } from './ToolCallView.js';
import { MarkdownView } from './components/MarkdownView.js';
import { formatDuration } from '../utils/formatDuration.js';

interface ToolCallMessage {
  type: 'tool_call';
  toolName: string;
  args: Record<string, unknown>;
  result?: { success: boolean; content?: string; error?: string };
  /** Wall-clock time the tool call started, in ms (Date.now()). */
  startedAt?: number;
  /** How long the tool took once finished, in ms. */
  durationMs?: number;
}

interface TextMessage {
  type: 'text';
  role: 'user' | 'assistant';
  content: string;
  /** Wall-clock time the assistant took to produce this answer, in ms. */
  durationMs?: number;
}

export type ChatMessage = TextMessage | ToolCallMessage;

/** The full, verbatim output of one tool call, toggled in/out via ctrl+o. */
export interface ExpandedOutput {
  toolName: string;
  content: string;
}

interface ChatViewProps {
  messages: ChatMessage[];
  streamingText: string;
  themeMode: 'dark' | 'light';
  /**
   * When set, the full output of a tool call is shown in the live region below
   * the transcript. It lives here (not in <Static>) so ctrl+o can toggle it
   * back off — committed scrollback can't be un-drawn.
   */
  expandedOutput?: ExpandedOutput | null;
}

/** True for a tool call that has not yet produced a result (still running). */
function isInProgress(msg: ChatMessage): boolean {
  return msg.type === 'tool_call' && !msg.result;
}

/** Renders a single settled message. Used both inside <Static> and the tail. */
function MessageItem({
  msg,
  themeMode,
}: {
  msg: ChatMessage;
  themeMode: 'dark' | 'light';
}): React.ReactElement {
  const colors = inkColors[themeMode];

  if (msg.type === 'tool_call') {
    return (
      <ToolCallView
        toolName={msg.toolName}
        args={msg.args}
        result={msg.result}
        startedAt={msg.startedAt}
        durationMs={msg.durationMs}
        themeMode={themeMode}
      />
    );
  }

  if (msg.role === 'user') {
    // Blocked: inverse strip so the user's message reads as a distinct block,
    // clearly separated from the assistant's answer below it. Multi-line input
    // is rendered one padded row per line so the inverse forms a single solid
    // rectangle — without padding, ragged line widths (and empty lines) make a
    // multi-line message look like several disconnected inputs.
    const lines = msg.content.split('\n');
    const innerWidth = Math.max(...lines.map(line => line.length));
    return (
      <Box flexDirection="column" marginY={1}>
        {lines.map((line, i) => (
          <Text key={i} color={colors.user} inverse>
            {` ${line.padEnd(innerWidth)} `}
          </Text>
        ))}
      </Box>
    );
  }

  // System/info notices (emitted via addSystemMessage with an "ℹ "
  // prefix) are not answers — render them dim, without the answer dot.
  if (msg.content.startsWith('ℹ ')) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color={colors.muted} dimColor wrap="wrap">
          {msg.content}
        </Text>
      </Box>
    );
  }

  // Errors are not answers either — mark them with a red dot.
  if (msg.content.startsWith('Error: ')) {
    return (
      <Box flexDirection="column" marginBottom={1}>
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
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={colors.success}>● </Text>
        <Box flexDirection="column" flexGrow={1}>
          <MarkdownView
            content={msg.content}
            color={colors.assistant}
            codeColor={colors.accent}
          />
          {msg.durationMs !== undefined && (
            <Text color={colors.muted} dimColor>
              {`Done in ${formatDuration(msg.durationMs)}`}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export function ChatView({
  messages,
  streamingText,
  themeMode,
  expandedOutput,
}: ChatViewProps): React.ReactElement {
  const colors = inkColors[themeMode];

  // Settled messages are committed to <Static>, which writes them once to the
  // terminal and lets them flow into native scrollback. This is what makes a
  // tall transcript scroll normally instead of fighting Ink's in-place frame
  // eraser. In-progress tool calls stay in the dynamic tail below so their
  // spinner/elapsed timer can keep updating.
  const settled = messages.filter(msg => !isInProgress(msg));
  const inProgress = messages.filter(isInProgress);

  // <Static> tracks how many items it has already written. If the list shrinks
  // (e.g. /clear resets messages to []), bump a key to remount it cleanly.
  const epochRef = useRef(0);
  const prevLenRef = useRef(0);
  if (settled.length < prevLenRef.current) {
    epochRef.current += 1;
  }
  prevLenRef.current = settled.length;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Static key={epochRef.current} items={settled}>
        {(msg, idx) => <MessageItem key={idx} msg={msg} themeMode={themeMode} />}
      </Static>

      {inProgress.map((msg, idx) => (
        <MessageItem key={`progress-${idx}`} msg={msg} themeMode={themeMode} />
      ))}

      {expandedOutput && (
        <Box flexDirection="column" marginY={1} marginLeft={1}>
          <Text color={colors.muted} dimColor>
            {`⤷ ${expandedOutput.toolName} (full output) · ctrl+o to collapse`}
          </Text>
          <Text color={colors.muted} wrap="wrap">{expandedOutput.content}</Text>
        </Box>
      )}

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
