import React from 'react';
import { Box, Text } from 'ink';
import { inkColors } from './theme.js';
import type { SlashCommandEntry } from './SlashCommands.js';

const VISIBLE_COUNT = 10;

interface CommandPaletteProps {
  commands: SlashCommandEntry[];
  selectedIndex: number;
  themeMode: 'dark' | 'light';
}

export function CommandPalette({
  commands,
  selectedIndex,
  themeMode,
}: CommandPaletteProps): React.ReactElement | null {
  if (commands.length === 0) return null;

  const colors = inkColors[themeMode];
  const total = commands.length;

  // Calculate the visible window so selectedIndex stays centered when possible
  const half = Math.floor(VISIBLE_COUNT / 2);
  let start = Math.max(0, selectedIndex - half);
  const end = Math.min(total, start + VISIBLE_COUNT);
  // Adjust start if we're near the bottom and the window would be short
  if (end - start < VISIBLE_COUNT && start > 0) {
    start = Math.max(0, end - VISIBLE_COUNT);
  }
  const visible = commands.slice(start, end);
  const hasMoreAbove = start > 0;
  const hasMoreBelow = end < total;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.accent}
      paddingX={1}
      marginX={1}
    >
      {hasMoreAbove && (
        <Box gap={1}>
          <Text color={colors.muted}>  ↑ {start} more</Text>
        </Box>
      )}
      {visible.map((cmd, idx) => {
        const globalIdx = start + idx;
        const isSelected = globalIdx === selectedIndex;
        const argStr = cmd.args ? ` ${cmd.args}` : '';

        return (
          <Box key={cmd.name} gap={1}>
            <Text color={isSelected ? colors.accent : colors.muted}>
              {isSelected ? '▸' : ' '}
            </Text>
            <Text color={isSelected ? colors.accent : colors.toolCall} bold={isSelected}>
              {cmd.name}
            </Text>
            {argStr && <Text color={colors.muted}>{argStr}</Text>}
            <Text color={isSelected ? colors.user : colors.muted} dimColor={!isSelected}>
              {cmd.description}
            </Text>
          </Box>
        );
      })}
      {hasMoreBelow && (
        <Box gap={1}>
          <Text color={colors.muted}>  ↓ {total - end} more</Text>
        </Box>
      )}
    </Box>
  );
}
