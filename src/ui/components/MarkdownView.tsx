import React from 'react';
import { Text, Box } from 'ink';

interface MarkdownViewProps {
  content: string;
  color?: string;
}

export function MarkdownView({ content, color }: MarkdownViewProps): React.ReactElement {
  const lines = content.split('\n');

  return (
    <Box flexDirection="column">
      {lines.map((line, idx) => {
        if (line.startsWith('```')) {
          return <Text key={idx} color="#888888">{line}</Text>;
        }
        if (line.startsWith('# ')) {
          return <Text key={idx} bold color={color}>{line.slice(2)}</Text>;
        }
        if (line.startsWith('## ')) {
          return <Text key={idx} bold color={color}>{line.slice(3)}</Text>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <Text key={idx} color={color}>  • {line.slice(2)}</Text>;
        }
        return <Text key={idx} color={color} wrap="wrap">{line}</Text>;
      })}
    </Box>
  );
}
