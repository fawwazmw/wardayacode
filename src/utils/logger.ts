import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLOR: Record<LogLevel, (s: string) => string> = {
  debug: chalk.gray,
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
};

let currentLevel: LogLevel = (process.env['LOG_LEVEL'] as LogLevel) ?? 'warn';
let logFileStream: fs.WriteStream | null = null;
let debugMode = false;

function getLogDir(): string {
  return path.join(os.homedir(), '.wardayacode', 'logs');
}

function openLogFile(sessionId: string): void {
  const logDir = getLogDir();
  fs.mkdirSync(logDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}-${sessionId.slice(0, 8)}.log`;
  const logPath = path.join(logDir, filename);

  logFileStream = fs.createWriteStream(logPath, { flags: 'a' });
}

function writeToFile(level: LogLevel, msg: string, meta?: unknown): void {
  if (!logFileStream) return;
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta !== undefined ? { meta } : {}),
  });
  logFileStream.write(entry + '\n');
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function log(level: LogLevel, msg: string, meta?: unknown): void {
  writeToFile(level, msg, meta);

  if (!shouldLog(level)) return;

  const color = LEVEL_COLOR[level];
  const prefix = color(`[${level}]`);
  const metaStr = meta !== undefined ? ' ' + chalk.gray(JSON.stringify(meta)) : '';
  process.stderr.write(`${prefix} ${msg}${metaStr}\n`);
}

export const logger = {
  debug(msg: string, meta?: unknown): void {
    log('debug', msg, meta);
  },

  info(msg: string, meta?: unknown): void {
    log('info', msg, meta);
  },

  warn(msg: string, meta?: unknown): void {
    log('warn', msg, meta);
  },

  error(msg: string, meta?: unknown): void {
    log('error', msg, meta);
  },

  setLevel(level: LogLevel): void {
    currentLevel = level;
  },

  setDebug(enabled: boolean): void {
    debugMode = enabled;
    if (enabled) currentLevel = 'debug';
  },

  isDebug(): boolean {
    return debugMode;
  },

  init(sessionId: string): void {
    openLogFile(sessionId);
    logger.debug('session started', { sessionId });
  },

  close(): void {
    if (logFileStream) {
      logFileStream.end();
      logFileStream = null;
    }
  },

  getLogDir,
};
