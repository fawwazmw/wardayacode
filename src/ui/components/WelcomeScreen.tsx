import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { PermissionMode } from "../../types.js";

const LOGO_LINES = [
  "██     ██  █████  ██████  ██████   █████  ██    ██  █████   ██████  ██████  ██████  ███████ ",
  "██     ██ ██   ██ ██   ██ ██   ██ ██   ██  ██  ██  ██   ██ ██      ██    ██ ██   ██ ██      ",
  "██  █  ██ ███████ ██████  ██   ██ ███████   ████   ███████ ██      ██    ██ ██   ██ █████   ",
  "██ ███ ██ ██   ██ ██   ██ ██   ██ ██   ██    ██    ██   ██ ██      ██    ██ ██   ██ ██      ",
  " ███ ███  ██   ██ ██   ██ ██████  ██   ██    ██    ██   ██  ██████  ██████  ██████  ███████ ",
];

const MODE_COLORS: Record<string, string> = {
  default: "#818CF8",
  plan: "#FBBF24",
  acceptEdits: "#34D399",
  auto: "#22D3EE",
  internal: "#F87171",
};

const TIPS = [
  ["Type a message", "to start coding with AI"],
  ["Type /", "to open the command palette"],
  ["Press Ctrl+C", "to cancel current operation"],
  ["/undo", "to revert the last file change"],
  ["/diff", "to see uncommitted git changes"],
];

interface WelcomeScreenProps {
  model: string;
  permissionMode: PermissionMode;
  sessionId: string;
  cwd: string;
  themeMode: "dark" | "light";
  version: string;
}

export function WelcomeScreen({
  model,
  permissionMode,
  sessionId,
  cwd,
  themeMode,
  version,
}: WelcomeScreenProps): React.ReactElement {
  const isDark = themeMode === "dark";
  const mutedColor = isDark ? "#555555" : "#AAAAAA";
  const dimColor = isDark ? "#444444" : "#BBBBBB";
  const textColor = isDark ? "#A0A0A0" : "#555555";
  const keyColor = isDark ? "#A78BFA" : "#7C3AED";
  const cmdColor = isDark ? "#C084FC" : "#9333EA";
  const wardayaColor = isDark ? "#60A5FA" : "#2563EB";
  const codeColor = isDark ? "#C084FC" : "#9333EA";

  const [phase, setPhase] = useState<"glow" | "info" | "ready">("glow");
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    if (phase === "glow") {
      const timer = setTimeout(() => setPhase("info"), 250);
      return () => clearTimeout(timer);
    }
    if (phase === "info") {
      const timer = setTimeout(() => setPhase("ready"), 250);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "ready") {
      const interval = setInterval(
        () => setTipIdx((prev) => (prev + 1) % TIPS.length),
        5000,
      );
      return () => clearInterval(interval);
    }
  }, [phase]);

  const shortCwd = cwd.replace(/^\/home\/[^/]+/, "~");
  const modeColor = MODE_COLORS[permissionMode] ?? keyColor;

  const tip = TIPS[tipIdx]!;

  const renderLogo = () => {
    const codeStartColumn = 70;

    return LOGO_LINES.map((line, idx) => {
      const wardayaPart = line.slice(0, codeStartColumn);
      const codePart = line.slice(codeStartColumn);

      return (
        <Text key={idx} bold>
          <Text color={wardayaColor}>{wardayaPart}</Text>
          <Text color={codeColor}>{codePart}</Text>
        </Text>
      );
    });
  };

  return (
    <Box
      flexDirection="column"
      paddingX={2}
      flexGrow={1}
      justifyContent="center"
    >
      <Box flexDirection="column" alignItems="center">
        <Box flexDirection="column" alignItems="center">
          <Box flexDirection="column">{renderLogo()}</Box>
          <Box marginTop={1}>
            <Text color={codeColor}>agentic coding in your terminal</Text>
          </Box>
        </Box>
      </Box>

      {(phase === "info" || phase === "ready") && (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Box gap={1}>
            <Text color={dimColor}>v{version}</Text>
            <Text color={dimColor}>·</Text>
            <Text color={keyColor}>{model}</Text>
            <Text color={dimColor}>·</Text>
            <Text color={modeColor}>{permissionMode}</Text>
          </Box>
          <Text color={dimColor}>{shortCwd}</Text>
        </Box>
      )}

      {phase === "ready" && (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Box
            borderStyle="round"
            borderColor={dimColor}
            paddingX={2}
            paddingY={0}
            flexDirection="column"
          >
            <Box gap={3}>
              <Box flexDirection="column">
                <Text color={mutedColor} bold>
                  Keys
                </Text>
                <Text>
                  <Text color={keyColor}>Enter </Text>
                  <Text color={textColor}>Send</Text>
                </Text>
                <Text>
                  <Text color={keyColor}>/ </Text>
                  <Text color={textColor}>Commands</Text>
                </Text>
                <Text>
                  <Text color={keyColor}>↑ ↓ </Text>
                  <Text color={textColor}>History</Text>
                </Text>
                <Text>
                  <Text color={keyColor}>Ctrl+C </Text>
                  <Text color={textColor}>Cancel</Text>
                </Text>
              </Box>
              <Box flexDirection="column">
                <Text color={mutedColor} bold>
                  Commands
                </Text>
                <Text>
                  <Text color={cmdColor}>/help </Text>
                  <Text color={textColor}>Show all</Text>
                </Text>
                <Text>
                  <Text color={cmdColor}>/mode </Text>
                  <Text color={textColor}>Permissions</Text>
                </Text>
                <Text>
                  <Text color={cmdColor}>/undo </Text>
                  <Text color={textColor}>Revert edit</Text>
                </Text>
                <Text>
                  <Text color={cmdColor}>/diff </Text>
                  <Text color={textColor}>Git changes</Text>
                </Text>
              </Box>
            </Box>
          </Box>

          <Box marginTop={1}>
            <Text color={dimColor}>
              <Text color={keyColor}>{tip[0]}</Text> {tip[1]}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
