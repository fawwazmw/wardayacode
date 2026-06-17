import React from 'react';
import { Box, Text } from 'ink';
import { inkColors } from './theme.js';
import type { SlashCommandEntry } from './SlashCommands.js';

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

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.accent}
      paddingX={1}
      marginX={1}
    >
      {commands.map((cmd, idx) => {
        const isSelected = idx === selectedIndex;
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
    </Box>
  );
}
