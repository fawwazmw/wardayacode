import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { inkColors } from './theme.js';

interface PermissionPromptProps {
  toolName: string;
  args: Record<string, unknown>;
  reason: string;
  themeMode: 'dark' | 'light';
  onDecision: (decision: 'allow' | 'deny' | 'always') => void;
}

function formatArgs(args: Record<string, unknown>): string {
  const filePath = args.filePath ?? args.path ?? args.command;
  if (typeof filePath === 'string') {
    return filePath.length > 60 ? filePath.slice(0, 57) + '...' : filePath;
  }
  const str = JSON.stringify(args);
  return str.length > 60 ? str.slice(0, 57) + '...' : str;
}

export function PermissionPrompt({
  toolName,
  args,
  reason,
  themeMode,
  onDecision,
}: PermissionPromptProps): React.ReactElement {
  const colors = inkColors[themeMode];
  const [answered, setAnswered] = useState(false);

  useInput((input, key) => {
    if (answered) return;
    const lower = input.toLowerCase();
    if (lower === 'y' || key.return) {
      setAnswered(true);
      onDecision('allow');
    } else if (lower === 'n' || key.escape) {
      setAnswered(true);
      onDecision('deny');
    } else if (lower === 'a') {
      setAnswered(true);
      onDecision('always');
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.warning}
      paddingX={1}
      marginX={1}
    >
      <Box gap={1}>
        <Text color={colors.warning}>⚠</Text>
        <Text color={colors.warning} bold>{toolName}</Text>
        <Text color={colors.muted}>{formatArgs(args)}</Text>
      </Box>
      <Box gap={2} marginLeft={2}>
        <Text color={colors.success}>[Y]es</Text>
        <Text color={colors.error}>[N]o</Text>
        <Text color={colors.accent}>[A]lways</Text>
        <Text color={colors.muted} dimColor>{reason}</Text>
      </Box>
    </Box>
  );
}
