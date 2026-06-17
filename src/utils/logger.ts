import chalk from 'chalk';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = (process.env['LOG_LEVEL'] as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

export const logger = {
  debug(msg: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.error(chalk.gray(`[debug] ${msg}`), ...args);
    }
  },

  info(msg: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.error(chalk.blue(`[info] ${msg}`), ...args);
    }
  },

  warn(msg: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.error(chalk.yellow(`[warn] ${msg}`), ...args);
    }
  },

  error(msg: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(chalk.red(`[error] ${msg}`), ...args);
    }
  },

  setLevel(level: LogLevel): void {
    currentLevel = level;
  },
};
