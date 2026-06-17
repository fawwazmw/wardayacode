import React from 'react';
import { Box, Text } from 'ink';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    process.stderr.write(`[wardayacode] UI crash: ${error.message}\n${info.componentStack ?? ''}\n`);
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>UI Error</Text>
          <Text color="red">{this.state.error.message}</Text>
          <Text dimColor>Check stderr for the full stack trace. Press Ctrl+C to exit.</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
