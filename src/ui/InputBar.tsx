import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { inkColors } from './theme.js';
import { CommandPalette } from './CommandPalette.js';
import { filterCommands } from './SlashCommands.js';
import { Spinner } from './components/Spinner.js';
import figures from 'figures';

interface InputBarProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
  themeMode: 'dark' | 'light';
  onInterrupt?: () => void;
}

const MAX_HISTORY = 50;

export function InputBar({
  onSubmit,
  isLoading,
  themeMode,
  onInterrupt,
}: InputBarProps): React.ReactElement {
  const { exit } = useApp();
  const [value, setValue] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const draftRef = useRef('');
  const colors = inkColors[themeMode];

  const filteredCommands = useMemo(() => {
    const noSpaces = !value.includes(' ');
    if (noSpaces && value.startsWith('/')) {
      return filterCommands(value);
    }
    return [];
  }, [value]);

  const showPalette = filteredCommands.length > 0 && !isLoading;

  const applyCompletion = useCallback((commandName: string) => {
    setValue(commandName + ' ');
    setCursorPos(commandName.length + 1);
    setPaletteIndex(0);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;

    if (historyRef.current[0] !== trimmed) {
      historyRef.current.unshift(trimmed);
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.pop();
      }
    }
    historyIndexRef.current = -1;
    draftRef.current = '';

    onSubmit(trimmed);
    setValue('');
    setCursorPos(0);
    setPaletteIndex(0);
  }, [value, onSubmit]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (isLoading && onInterrupt) {
        onInterrupt();
      } else if (value.length > 0) {
        setValue('');
        setCursorPos(0);
        setPaletteIndex(0);
      } else {
        exit();
      }
      return;
    }

    if (key.ctrl && input === 'd') {
      exit();
      return;
    }

    if (isLoading) return;

    if (key.escape) {
      if (showPalette) {
        setValue('');
        setCursorPos(0);
        setPaletteIndex(0);
      }
      return;
    }

    if (key.tab && showPalette) {
      const selected = filteredCommands[paletteIndex];
      if (selected) {
        applyCompletion(selected.name);
      }
      return;
    }

    if (key.return) {
      if (showPalette && filteredCommands.length > 0) {
        const selected = filteredCommands[paletteIndex];
        if (selected) {
          if (selected.args) {
            applyCompletion(selected.name);
          } else {
            setValue(selected.name);
            setCursorPos(selected.name.length);
            setPaletteIndex(0);
            // submit immediately for commands without args
            onSubmit(selected.name);
            setValue('');
            setCursorPos(0);
          }
        }
      } else {
        handleSubmit();
      }
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorPos > 0) {
        const newVal = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
        setValue(newVal);
        setCursorPos(cursorPos - 1);
        setPaletteIndex(0);
      }
      return;
    }

    if (key.upArrow) {
      if (showPalette) {
        setPaletteIndex(prev => Math.max(0, prev - 1));
        return;
      }
      const history = historyRef.current;
      if (history.length === 0) return;
      if (historyIndexRef.current === -1) {
        draftRef.current = value;
      }
      const nextIdx = Math.min(historyIndexRef.current + 1, history.length - 1);
      historyIndexRef.current = nextIdx;
      const historyValue = history[nextIdx] ?? '';
      setValue(historyValue);
      setCursorPos(historyValue.length);
      return;
    }

    if (key.downArrow) {
      if (showPalette) {
        setPaletteIndex(prev => Math.min(filteredCommands.length - 1, prev + 1));
        return;
      }
      if (historyIndexRef.current <= -1) return;
      const nextIdx = historyIndexRef.current - 1;
      historyIndexRef.current = nextIdx;
      if (nextIdx < 0) {
        setValue(draftRef.current);
        setCursorPos(draftRef.current.length);
      } else {
        const historyValue = historyRef.current[nextIdx] ?? '';
        setValue(historyValue);
        setCursorPos(historyValue.length);
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPos(prev => Math.max(0, prev - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPos(prev => Math.min(value.length, prev + 1));
      return;
    }

    if (key.ctrl && input === 'a') { setCursorPos(0); return; }
    if (key.ctrl && input === 'e') { setCursorPos(value.length); return; }

    if (key.ctrl && input === 'u') {
      setValue(value.slice(cursorPos));
      setCursorPos(0);
      setPaletteIndex(0);
      return;
    }

    if (key.ctrl && input === 'k') {
      setValue(value.slice(0, cursorPos));
      return;
    }

    if (key.ctrl && input === 'w') {
      const before = value.slice(0, cursorPos);
      const after = value.slice(cursorPos);
      const lastSpace = before.trimEnd().lastIndexOf(' ');
      const newBefore = lastSpace === -1 ? '' : before.slice(0, lastSpace + 1);
      setValue(newBefore + after);
      setCursorPos(newBefore.length);
      setPaletteIndex(0);
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      const newVal = value.slice(0, cursorPos) + input + value.slice(cursorPos);
      setValue(newVal);
      setCursorPos(cursorPos + input.length);
      setPaletteIndex(0);
    }
  });

  const beforeCursor = value.slice(0, cursorPos);
  const afterCursor = value.slice(cursorPos);

  return (
    <Box flexDirection="column">
      {showPalette && (
        <CommandPalette
          commands={filteredCommands}
          selectedIndex={paletteIndex}
          themeMode={themeMode}
        />
      )}
      <Box paddingX={1} gap={1}>
        {isLoading ? (
          <Spinner label="Thinking..." color={colors.accent} />
        ) : (
          <>
            <Text color={colors.accent}>{figures.pointer}</Text>
            <Text>
              <Text color={colors.user}>{beforeCursor}</Text>
              <Text color={colors.accent}>▌</Text>
              <Text color={colors.user}>{afterCursor}</Text>
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
}
