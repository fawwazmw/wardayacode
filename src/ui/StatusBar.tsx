import React from 'react';
import { Box, Text } from 'ink';
import type { PermissionMode } from '../types.js';

interface StatusBarProps {
  model: string;
  tokenUsage: { input: number; output: number };
  permissionMode: PermissionMode;
  sessionId: string;
  themeMode: 'dark' | 'light';
}

const MODE_STYLE: Record<PermissionMode, { icon: string; color: string }> = {
  default: { icon: '◆', color: '#818CF8' },
  plan: { icon: '◇', color: '#FBBF24' },
  acceptEdits: { icon: '●', color: '#34D399' },
  auto: { icon: '⚡', color: '#22D3EE' },
  internal: { icon: '⬥', color: '#F87171' },
};

function fmtTokens(n: number): string {
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function StatusBar({
  model,
  tokenUsage,
  permissionMode,
  sessionId,
  themeMode,
}: StatusBarProps): React.ReactElement {
  const isDark = themeMode === 'dark';
  const sep = isDark ? '#333333' : '#CCCCCC';
  const dim = isDark ? '#555555' : '#999999';
  const mode = MODE_STYLE[permissionMode];
  const total = tokenUsage.input + tokenUsage.output;

  return (
    <Box paddingX={1} justifyContent="space-between" width="100%">
      <Box gap={1}>
        <Text color={mode.color}>{mode.icon}</Text>
        <Text color={dim}>{model}</Text>
      </Box>
      <Box gap={1}>
        {total > 0 && (
          <>
            <Text color={dim}>{fmtTokens(total)} tokens</Text>
            <Text color={sep}>│</Text>
          </>
        )}
        <Text color={mode.color}>{permissionMode}</Text>
        <Text color={sep}>│</Text>
        <Text color={dim}>{sessionId.slice(0, 8)}</Text>
      </Box>
    </Box>
  );
}
