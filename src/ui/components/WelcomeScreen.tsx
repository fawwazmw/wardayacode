import React from "react";
import { Box, Text } from "ink";
import type { PermissionMode } from "../../types.js";

// W monogram in pixel-box style (3 lines)
const W_SYMBOL = [
  " ▐▛█ █▜▌",
  "▝▜█████▛▘",
  "  ▘█ █▝  ",
];

interface WelcomeScreenProps {
  model: string;
  permissionMode: PermissionMode;
  sessionId: string;
  cwd: string;
  themeMode: "dark" | "light";
  version: string;
  latestVersion?: string;
  updateAvailable?: boolean;
}

export function WelcomeScreen({
  model,
  permissionMode,
  sessionId: _sessionId,
  cwd,
  themeMode,
  version,
  latestVersion,
  updateAvailable = false,
}: WelcomeScreenProps): React.ReactElement {
  const isDark = themeMode === "dark";
  const dimColor = isDark ? "#444444" : "#BBBBBB";
  const mutedColor = isDark ? "#555555" : "#AAAAAA";
  const keyColor = isDark ? "#A78BFA" : "#7C3AED";
  const accentColor = isDark ? "#60A5FA" : "#2563EB";
  const modeColor: Record<string, string> = {
    default: "#818CF8",
    plan: "#FBBF24",
    acceptEdits: "#34D399",
    auto: "#22D3EE",
    internal: "#F87171",
  };

  const shortCwd = cwd.replace(/^\/home\/[^/]+/, "~");
  const modeLabel = permissionMode.charAt(0).toUpperCase() + permissionMode.slice(1);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1} alignItems="center">
      {/* W symbol */}
      <Box flexDirection="column" alignItems="center">
        {W_SYMBOL.map((line, i) => (
          <Text key={i} bold color={accentColor}>
            {line}
          </Text>
        ))}
      </Box>

      {/* WDC · Wardayacode branding */}
      <Box marginTop={1}>
        <Text bold>
          <Text color={accentColor}>WDC</Text>
          <Text color={dimColor}> · </Text>
          <Text>Wardayacode</Text>
          <Text color={dimColor}> v{version}</Text>
        </Text>
      </Box>

      {/* Model + permission mode */}
      <Text color={mutedColor}>
        {model} · {modeLabel}
      </Text>

      {/* Working directory */}
      <Text color={dimColor}>{shortCwd}</Text>

      {/* Update available banner */}
      {updateAvailable && latestVersion && (
        <Box marginTop={1}>
          <Text color={isDark ? "#FBBF24" : "#D97706"}>
            Update available: v{version} → v{latestVersion}
          </Text>
          <Text color={dimColor}>
            {' '}Run wardayacode update
          </Text>
        </Box>
      )}

      {/* Tips row */}
      <Box marginTop={1}>
        <Text color={mutedColor}>
          <Text color={keyColor}>Type a message</Text>
          {' '}to start coding with AI {'  '}
          <Text color={keyColor}>/help</Text>
          {' '}for commands
        </Text>
      </Box>
    </Box>
  );
}
