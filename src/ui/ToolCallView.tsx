import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { inkColors } from './theme.js';
import { Spinner } from './components/Spinner.js';
import { formatDuration } from '../utils/formatDuration.js';
import { previewToolOutput } from '../utils/toolOutputPreview.js';

/** How many lines of a tool's output to show before collapsing the rest. */
const PREVIEW_LINES = 4;

interface ToolCallViewProps {
  toolName: string;
  args: Record<string, unknown>;
  result?: { success: boolean; content?: string; error?: string };
  /** Wall-clock time the tool call started, in ms (Date.now()). */
  startedAt?: number;
  /** How long the tool took once finished, in ms. */
  durationMs?: number;
  themeMode: 'dark' | 'light';
}

function summarizeArgs(args: Record<string, unknown>): string {
  const filePath = args.filePath ?? args.path ?? args.pattern ?? args.command;
  if (typeof filePath === 'string') {
    return filePath.length > 70 ? filePath.slice(0, 67) + '...' : filePath;
  }
  const str = JSON.stringify(args);
  return str.length > 70 ? str.slice(0, 67) + '...' : str;
}

/** A self-ticking elapsed-time readout for an in-progress tool call. */
function ElapsedTimer({ startedAt, color }: { startedAt: number; color: string }): React.ReactElement {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color={color} dimColor>
      {formatDuration(Math.max(0, now - startedAt))}
    </Text>
  );
}

export function ToolCallView({
  toolName,
  args,
  result,
  startedAt,
  durationMs,
  themeMode,
}: ToolCallViewProps): React.ReactElement {
  const colors = inkColors[themeMode];

  const iconColor = result
    ? result.success ? colors.success : colors.error
    : colors.warning;

  // Collapsed preview of the tool's output: stdout on success, the error text
  // on failure. Rendered under a `⎿` connector, capped at PREVIEW_LINES.
  const outputText = result
    ? result.success
      ? result.content ?? ''
      : result.error ?? result.content ?? ''
    : '';
  const preview = previewToolOutput(outputText, PREVIEW_LINES);
  const outputColor = result && !result.success ? colors.error : colors.muted;

  return (
    <Box flexDirection="column" marginBottom={0} marginLeft={1}>
      <Box gap={1}>
        {result ? (
          <Text color={iconColor}>{result.success ? '✓' : '✗'}</Text>
        ) : (
          <Spinner color={colors.warning} />
        )}
        <Text color={colors.toolCall} bold>{toolName}</Text>
        <Text color={colors.muted} dimColor>{summarizeArgs(args)}</Text>
        {!result && startedAt !== undefined && (
          <ElapsedTimer startedAt={startedAt} color={colors.muted} />
        )}
        {result && durationMs !== undefined && (
          <Text color={colors.muted} dimColor>{formatDuration(durationMs)}</Text>
        )}
      </Box>
      {result && preview.lines.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {preview.lines.map((line, i) => (
            <Box key={i} gap={1}>
              <Text color={colors.muted} dimColor>{i === 0 ? '⎿' : ' '}</Text>
              <Box flexGrow={1}>
                <Text color={outputColor} dimColor wrap="wrap">{line || ' '}</Text>
              </Box>
            </Box>
          ))}
          {preview.hiddenCount > 0 && (
            <Box gap={1}>
              <Text color={colors.muted} dimColor> </Text>
              <Text color={colors.muted} dimColor>{`… +${preview.hiddenCount} lines (ctrl+o to expand)`}</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
