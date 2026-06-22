import React from 'react';
import { Text, Box } from 'ink';
import { parseInlineMarkdown } from '../../utils/parseInlineMarkdown.js';

interface MarkdownViewProps {
  content: string;
  /** Base color for plain text. */
  color?: string;
  /** Color for inline `code` spans. Falls back to a neutral accent. */
  codeColor?: string;
}

/**
 * Render a line of text with inline markup (`**bold**`, `` `code` ``,
 * `*italic*`) resolved into styled Ink <Text> spans. A single <Text> wraps the
 * spans so Ink keeps them on one flowing line.
 */
function InlineLine({
  line,
  color,
  codeColor,
}: {
  line: string;
  color?: string;
  codeColor: string;
}): React.ReactElement {
  const segments = parseInlineMarkdown(line);
  if (segments.length === 0) {
    return <Text color={color}> </Text>;
  }
  return (
    <Text color={color} wrap="wrap">
      {segments.map((seg, idx) => {
        if (seg.code) {
          return (
            <Text key={idx} color={codeColor}>
              {seg.text}
            </Text>
          );
        }
        return (
          <Text key={idx} bold={seg.bold} italic={seg.italic}>
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
}

export function MarkdownView({
  content,
  color,
  codeColor = '#C084FC',
}: MarkdownViewProps): React.ReactElement {
  const lines = content.split('\n');
  let inCodeFence = false;

  return (
    <Box flexDirection="column">
      {lines.map((line, idx) => {
        // Fenced code blocks: render the fence dim and everything inside it
        // verbatim (no inline parsing).
        if (line.startsWith('```')) {
          inCodeFence = !inCodeFence;
          return (
            <Text key={idx} color="#888888">
              {line}
            </Text>
          );
        }
        if (inCodeFence) {
          return (
            <Text key={idx} color={codeColor}>
              {line}
            </Text>
          );
        }

        if (line.startsWith('# ')) {
          return (
            <Text key={idx} bold color={color}>
              {line.slice(2)}
            </Text>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <Text key={idx} bold color={color}>
              {line.slice(3)}
            </Text>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <Text key={idx} bold color={color}>
              {line.slice(4)}
            </Text>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <Box key={idx}>
              <Text color={color}>{'  • '}</Text>
              <Box flexGrow={1}>
                <InlineLine line={line.slice(2)} color={color} codeColor={codeColor} />
              </Box>
            </Box>
          );
        }
        return (
          <InlineLine key={idx} line={line} color={color} codeColor={codeColor} />
        );
      })}
    </Box>
  );
}
