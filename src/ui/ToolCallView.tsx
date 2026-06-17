import React from 'react';
import { Box, Text } from 'ink';
import { inkColors } from './theme.js';

interface ToolCallViewProps {
  toolName: string;
  args: Record<string, unknown>;
  result?: { success: boolean; content?: string; error?: string };
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

export function ToolCallView({
  toolName,
  args,
  result,
  themeMode,
}: ToolCallViewProps): React.ReactElement {
  const colors = inkColors[themeMode];
  const isDark = themeMode === 'dark';
  const dimBg = isDark ? '#1A1A2E' : '#F3F4F6';

  const icon = result
    ? result.success ? '✓' : '✗'
    : '⟳';

  const iconColor = result
    ? result.success ? colors.success : colors.error
    : colors.warning;

  return (
    <Box flexDirection="column" marginBottom={0} marginLeft={1}>
      <Box gap={1}>
        <Text color={iconColor}>{icon}</Text>
        <Text color={colors.toolCall} bold>{toolName}</Text>
        <Text color={colors.muted} dimColor>{summarizeArgs(args)}</Text>
      </Box>
      {result && !result.success && result.error && (
        <Box marginLeft={3}>
          <Text color={colors.error} dimColor wrap="wrap">{result.error.slice(0, 200)}</Text>
        </Box>
      )}
    </Box>
  );
}
