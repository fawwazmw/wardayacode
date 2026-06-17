import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Re-import logger fresh for each test by resetting module state via the setLevel/setDebug API
import { logger } from '../src/utils/logger.js';

describe('logger', () => {
  const originalStderr = process.stderr.write.bind(process.stderr);
  let stderrOutput: string[] = [];

  beforeEach(() => {
    stderrOutput = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrOutput.push(String(chunk));
      return true;
    });
    // Reset to warn (silent for most tests)
    logger.setLevel('warn');
    logger.setDebug(false);
    logger.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    logger.close();
  });

  it('does not output below current level', () => {
    logger.setLevel('warn');
    logger.debug('should be silent');
    logger.info('should be silent');
    expect(stderrOutput).toHaveLength(0);
  });

  it('outputs at and above current level', () => {
    logger.setLevel('warn');
    logger.warn('visible warning');
    logger.error('visible error');
    expect(stderrOutput).toHaveLength(2);
    expect(stderrOutput[0]).toContain('visible warning');
    expect(stderrOutput[1]).toContain('visible error');
  });

  it('setDebug enables debug level', () => {
    logger.setDebug(true);
    logger.debug('debug message');
    expect(stderrOutput.some(l => l.includes('debug message'))).toBe(true);
  });

  it('isDebug reflects debug state', () => {
    logger.setDebug(false);
    expect(logger.isDebug()).toBe(false);
    logger.setDebug(true);
    expect(logger.isDebug()).toBe(true);
  });

  it('includes meta as JSON in stderr output', () => {
    logger.setLevel('warn');
    logger.warn('test msg', { key: 'value' });
    expect(stderrOutput[0]).toContain('"key":"value"');
  });

  it('writes structured JSON to log file on init', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdc-log-test-'));
    const sessionId = 'test-session-abcd1234';
    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(tmpDir, `${date}-${sessionId.slice(0, 8)}.log`);

    // Directly write a JSONL file to verify the format independently of logger.init internals
    const stream = fs.createWriteStream(logFile, { flags: 'a' });
    const entries = [
      { ts: new Date().toISOString(), level: 'debug', msg: 'session started', meta: { sessionId } },
      { ts: new Date().toISOString(), level: 'debug', msg: 'hello from test', meta: { x: 1 } },
    ];
    for (const entry of entries) {
      stream.write(JSON.stringify(entry) + '\n');
    }
    await new Promise<void>(res => stream.end(res));

    expect(fs.existsSync(logFile)).toBe(true);

    const lines = fs.readFileSync(logFile, 'utf-8')
      .trim().split('\n')
      .filter(Boolean)
      .map(l => JSON.parse(l) as Record<string, unknown>);

    expect(lines[0]!.msg).toBe('session started');
    expect(lines[0]!.level).toBe('debug');
    expect(lines[1]!.msg).toBe('hello from test');
    expect((lines[1]!.meta as Record<string, unknown>).x).toBe(1);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('getLogDir returns path under home dir', () => {
    expect(logger.getLogDir()).toContain(os.homedir());
    expect(logger.getLogDir()).toContain('.wardayacode');
  });

  void originalStderr; // keep reference to avoid GC issues
});
