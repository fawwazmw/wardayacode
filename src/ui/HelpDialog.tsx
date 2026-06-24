import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { inkColors } from './theme.js';
import { normalizeKittyKeys } from './kittyKeyboard.js';
import { SLASH_COMMANDS } from './SlashCommands.js';

interface HelpDialogProps {
  themeMode: 'dark' | 'light';
  onClose: () => void;
}

type SectionId = 'general' | 'commands' | 'custom-commands';

const SECTIONS: SectionId[] = ['general', 'commands', 'custom-commands'];

const SECTION_LABELS: Record<SectionId, string> = {
  general: 'General',
  commands: 'Commands',
  'custom-commands': 'Custom Commands',
};

// How many command rows are visible at once before the list scrolls.
const VISIBLE_COMMAND_ROWS = 7;

interface Shortcut {
  key: string;
  desc: string;
}

interface HelpCommand {
  name: string;
  desc: string;
}

// The full command catalog shown in the help dialog. This is a display-only
// reference list (kept separate from the live SLASH_COMMANDS registry that
// drives autocomplete and the command handler).
const HELP_COMMANDS: HelpCommand[] = [
  { name: '/add-dir', desc: 'Add a new working directory' },
  { name: '/agents', desc: 'Manage agent configurations' },
  { name: '/branch', desc: 'Create a branch of the current conversation at this point' },
  { name: '/anw', desc: 'Ask a quick side question without interrupting the main conversation' },
  { name: '/clear', desc: 'Start fresh: discard the current conversation and context' },
  { name: '/color', desc: 'Set the prompt bar color for this session' },
  { name: '/compact', desc: 'Clear conversation history but keep a summary in context' },
  { name: '/config', desc: 'Open config panel' },
  { name: '/context', desc: 'Visualize current usage as a colored grid' },
  { name: '/copy', desc: "Copy WardayaCode's last response to clipboard (/copy N for the Nth-latest)" },
  { name: '/cost', desc: 'Show the total cost and duration of the current session' },
  { name: '/diff', desc: 'View uncommitted changes and per-turn diffs' },
  { name: '/doctor', desc: 'Diagnose and verify your WardayaCode installation and settings' },
  { name: '/effort', desc: 'Set effort level for model usage' },
  { name: '/exit', desc: 'Exit the REPL' },
  { name: '/export', desc: 'Export the current conversation to a file or clipboard' },
  { name: '/fast', desc: 'Toggle fast mode' },
  { name: '/feedback', desc: 'Submit feedback about WardayaCode' },
  { name: '/help', desc: 'Show help and available commands' },
  { name: '/hooks', desc: 'View hook configurations for tool events' },
  { name: '/ide', desc: 'Manage IDE integrations and show status' },
  { name: '/init', desc: 'Initialize a new WARDAYA.md file with codebase documentation' },
  { name: '/insights', desc: 'Generate a report analyzing your WardayaCode sessions' },
  { name: '/keybindings', desc: 'Open or create your keybindings configuration file' },
  { name: '/mcp', desc: 'Manage MCP servers' },
  { name: '/memory', desc: 'Edit Wardaya memory files' },
  { name: '/model', desc: 'Set the AI model for WardayaCode' },
  { name: '/permissions', desc: 'Manage allow & deny tool permission rules' },
  { name: '/plan', desc: 'Enable plan mode or view the current session plan' },
  { name: '/plugin', desc: 'Manage WardayaCode plugins' },
  { name: '/recap', desc: 'Generate a one-line session recap now' },
  { name: '/release-notes', desc: 'View release notes' },
  { name: '/reload-plugins', desc: 'Activate pending plugin changes in the current session' },
  { name: '/rename', desc: 'Rename the current conversation' },
  { name: '/resume', desc: 'Resume a previous conversation' },
  { name: '/review', desc: 'Review a pull request' },
  { name: '/rewind', desc: 'Restore the code and/or conversation to a previous point' },
  { name: '/sandbox', desc: 'Configure the sandbox' },
  { name: '/security-review', desc: 'Complete a security review of the pending changes on the current branch' },
  { name: '/skills', desc: 'List available skills' },
  { name: '/stats', desc: 'Show your WardayaCode usage statistics and activity' },
  { name: '/status', desc: 'Show WardayaCode status including version, model, account, API connectivity, and tool statuses' },
  { name: '/statusline', desc: "Set up WardayaCode's status line UI" },
  { name: '/stickers', desc: 'Order WardayaCode stickers' },
  { name: '/tasks', desc: 'List and manage background tasks' },
  { name: '/team-onboarding', desc: 'Help teammates ramp on WardayaCode with a guide from your usage' },
  { name: '/theme', desc: 'Change the theme' },
  { name: '/tui', desc: 'Set the terminal UI renderer (default | fullscreen)' },
];

// Grouped so related shortcuts render with a blank line between blocks, matching
// the layout the user laid out.
const SHORTCUT_GROUPS: Shortcut[][] = [
  [
    { key: '!', desc: 'for bash mode' },
    { key: '/', desc: 'for commands' },
    { key: '@', desc: 'for file paths' },
    { key: '&', desc: 'for background' },
    { key: '/anw', desc: 'for side question' },
  ],
  [
    { key: 'double tap esc', desc: 'to clear input' },
    { key: 'shift + tab', desc: 'to auto-accept edits' },
    { key: 'ctrl + o', desc: 'for verbose output' },
    { key: 'ctrl + t', desc: 'to toggle tasks' },
    { key: '\\ + return', desc: 'for new line' },
  ],
  [
    { key: 'ctrl + shift + -', desc: 'to undo' },
    { key: 'ctrl + z', desc: 'to suspend' },
    { key: 'ctrl + v', desc: 'to paste images' },
    { key: 'alt + p', desc: 'to switch model' },
    { key: 'alt + o', desc: 'to toggle fast mode' },
    { key: 'ctrl + s', desc: 'to stash prompt' },
    { key: 'ctrl + g', desc: 'to edit in $EDITOR' },
    { key: '/keybindings', desc: 'to customize' },
  ],
];

// Names of commands that are actually wired up and runnable today. Derived from
// the live registry so the help dialog's "available" flag stays in sync as new
// commands graduate from the catalog to real implementations.
const AVAILABLE_COMMANDS = new Set(SLASH_COMMANDS.map(c => c.name));

export function HelpDialog({ themeMode, onClose }: HelpDialogProps): React.ReactElement {
  const colors = inkColors[themeMode];
  const [sectionIdx, setSectionIdx] = useState(0);
  const [commandScroll, setCommandScroll] = useState(0);

  const activeSection = SECTIONS[sectionIdx]!;
  const maxCommandScroll = Math.max(0, HELP_COMMANDS.length - VISIBLE_COMMAND_ROWS);

  useInput((rawInput, rawKey) => {
    const { input, key } = normalizeKittyKeys(rawInput, rawKey);

    if (key.escape || (key.ctrl && input === 'c') || input === 'q') {
      onClose();
      return;
    }

    // Tab / Right → next section; Shift+Tab / Left → previous. Wraps around.
    // Switching sections resets the command scroll back to the top.
    if ((key.tab && !key.shift) || key.rightArrow) {
      setSectionIdx(prev => (prev + 1) % SECTIONS.length);
      setCommandScroll(0);
      return;
    }
    if ((key.tab && key.shift) || key.leftArrow) {
      setSectionIdx(prev => (prev - 1 + SECTIONS.length) % SECTIONS.length);
      setCommandScroll(0);
      return;
    }

    // Up / Down scroll the (long) commands list one row at a time.
    if (activeSection === 'commands') {
      if (key.downArrow) {
        setCommandScroll(prev => Math.min(prev + 1, maxCommandScroll));
        return;
      }
      if (key.upArrow) {
        setCommandScroll(prev => Math.max(prev - 1, 0));
        return;
      }
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.accent}
      paddingX={2}
      paddingY={1}
      marginX={1}
    >
      <Box gap={2} marginBottom={1}>
        {SECTIONS.map((section, idx) => {
          const isActive = idx === sectionIdx;
          return (
            <Text
              key={section}
              color={isActive ? colors.accent : colors.muted}
              bold={isActive}
              underline={isActive}
            >
              {SECTION_LABELS[section]}
            </Text>
          );
        })}
      </Box>

      {activeSection === 'general' && (
        <GeneralSection themeMode={themeMode} />
      )}
      {activeSection === 'commands' && (
        <CommandsSection themeMode={themeMode} scrollOffset={commandScroll} />
      )}
      {activeSection === 'custom-commands' && (
        <CustomCommandsSection themeMode={themeMode} />
      )}

      <Box marginTop={1}>
        <Text color={colors.muted} dimColor>
          <Text color={colors.accent}>Tab</Text> / <Text color={colors.accent}>← →</Text> switch section
          {'   '}
          {activeSection === 'commands' && (
            <>
              <Text color={colors.accent}>↑ ↓</Text> scroll
              {'   '}
            </>
          )}
          <Text color={colors.accent}>Esc</Text> close
        </Text>
      </Box>
    </Box>
  );
}

function GeneralSection({ themeMode }: { themeMode: 'dark' | 'light' }): React.ReactElement {
  const colors = inkColors[themeMode];
  return (
    <Box flexDirection="row" gap={4}>
      {SHORTCUT_GROUPS.map((group, gIdx) => {
        // Align keys within each column to that column's widest key.
        const colKeyWidth = Math.max(...group.map(s => s.key.length));
        return (
          <Box key={gIdx} flexDirection="column">
            {group.map(shortcut => (
              <Text key={shortcut.key} wrap="truncate-end">
                <Text color={colors.accent}>{shortcut.key.padEnd(colKeyWidth)}</Text>
                <Text color={colors.muted}>{'  '}</Text>
                <Text color={colors.user}>{shortcut.desc}</Text>
              </Text>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}

function CommandsSection({
  themeMode,
  scrollOffset,
}: {
  themeMode: 'dark' | 'light';
  scrollOffset: number;
}): React.ReactElement {
  const colors = inkColors[themeMode];
  const nameWidth = Math.max(...HELP_COMMANDS.map(c => c.name.length));
  const visible = HELP_COMMANDS.slice(scrollOffset, scrollOffset + VISIBLE_COMMAND_ROWS);
  const firstShown = scrollOffset + 1;
  const lastShown = scrollOffset + visible.length;

  return (
    <Box flexDirection="column">
      {visible.map(cmd => {
        const available = AVAILABLE_COMMANDS.has(cmd.name);
        return (
          <Text key={cmd.name} wrap="truncate-end">
            <Text color={available ? colors.toolCall : colors.muted} dimColor={!available}>
              {cmd.name.padEnd(nameWidth)}
            </Text>
            <Text color={colors.muted}>{'  '}</Text>
            <Text color={available ? colors.user : colors.muted} dimColor={!available}>
              {cmd.desc}
            </Text>
            {!available && <Text color={colors.warning} dimColor>{'  (soon)'}</Text>}
          </Text>
        );
      })}
      <Box marginTop={1}>
        <Text color={colors.muted} dimColor>
          {firstShown}–{lastShown} of {HELP_COMMANDS.length}
          {scrollOffset > 0 ? '  ↑ more' : ''}
          {lastShown < HELP_COMMANDS.length ? '  ↓ more' : ''}
          {'   '}
          <Text color={colors.warning}>(soon)</Text> = not yet available
        </Text>
      </Box>
    </Box>
  );
}

function CustomCommandsSection({ themeMode }: { themeMode: 'dark' | 'light' }): React.ReactElement {
  const colors = inkColors[themeMode];
  return (
    <Box flexDirection="column">
      <Text color={colors.muted}>No custom commands yet.</Text>
      <Box marginTop={1}>
        <Text color={colors.muted} dimColor>
          Define your own commands as <Text color={colors.accent}>.md</Text> files in{' '}
          <Text color={colors.accent}>.wardayacode/commands/</Text> to see them here.
        </Text>
      </Box>
    </Box>
  );
}
