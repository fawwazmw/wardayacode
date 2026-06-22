import chalk from 'chalk';

export interface Theme {
  userMessage: typeof chalk;
  assistantMessage: typeof chalk;
  toolCall: typeof chalk;
  toolResult: typeof chalk;
  error: typeof chalk;
  success: typeof chalk;
  muted: typeof chalk;
  accent: typeof chalk;
  warning: typeof chalk;
  border: typeof chalk;
  label: typeof chalk;
}

export const darkTheme: Theme = {
  userMessage: chalk.white,
  assistantMessage: chalk.hex('#A78BFA'),
  toolCall: chalk.hex('#818CF8'),
  toolResult: chalk.hex('#6366F1'),
  error: chalk.hex('#F87171'),
  success: chalk.hex('#34D399'),
  muted: chalk.hex('#555555'),
  accent: chalk.hex('#C084FC'),
  warning: chalk.hex('#FBBF24'),
  border: chalk.hex('#333333'),
  label: chalk.bold.white,
};

export const lightTheme: Theme = {
  userMessage: chalk.hex('#1E1B4B'),
  assistantMessage: chalk.hex('#6D28D9'),
  toolCall: chalk.hex('#4F46E5'),
  toolResult: chalk.hex('#4338CA'),
  error: chalk.hex('#DC2626'),
  success: chalk.hex('#059669'),
  muted: chalk.hex('#9CA3AF'),
  accent: chalk.hex('#7C3AED'),
  warning: chalk.hex('#D97706'),
  border: chalk.hex('#D1D5DB'),
  label: chalk.bold.hex('#1E1B4B'),
};

export function getTheme(mode: 'dark' | 'light'): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}

export const inkColors = {
  dark: {
    user: '#E0E0E0',
    assistant: '#E0E0E0',
    toolCall: '#818CF8',
    toolResult: '#6366F1',
    error: '#F87171',
    success: '#34D399',
    muted: '#555555',
    accent: '#C084FC',
    warning: '#FBBF24',
    border: '#333333',
  },
  light: {
    user: '#1E1B4B',
    assistant: '#1F2937',
    toolCall: '#4F46E5',
    toolResult: '#4338CA',
    error: '#DC2626',
    success: '#059669',
    muted: '#9CA3AF',
    accent: '#7C3AED',
    warning: '#D97706',
    border: '#D1D5DB',
  },
} as const;
