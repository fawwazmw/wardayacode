import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { Session } from '../src/session/Session.js';
import { SessionManager } from '../src/session/SessionManager.js';

const TEST_DIR = join(tmpdir(), 'wardayacode-session-test-' + Date.now());

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('Session', () => {
  it('create() returns a session with a UUID id', async () => {
    const session = await Session.create(TEST_DIR, 'default');
    expect(session.getId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.getPermissionMode()).toBe('default');
  });

  it('getId() returns the id', async () => {
    const session = await Session.create(TEST_DIR, 'auto');
    expect(session.getId()).toBeDefined();
    expect(typeof session.getId()).toBe('string');
  });

  it('getPermissionMode() returns the mode passed to create()', async () => {
    const session = await Session.create(TEST_DIR, 'plan');
    expect(session.getPermissionMode()).toBe('plan');
  });

  it('append() writes a JSONL line to disk', async () => {
    const session = await Session.create(TEST_DIR, 'default');
    await session.append({ id: 'msg-1', role: 'user', content: 'hello' });

    const filePath = join(TEST_DIR, '.wardayacode', `${session.getId()}.jsonl`);
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content.trim().split('\n')[0]!);

    expect(parsed.id).toBe('msg-1');
    expect(parsed.role).toBe('user');
    expect(parsed.content).toBe('hello');
    expect(typeof parsed.timestamp).toBe('number');
  });

  it('append() creates the .wardayacode directory if missing', async () => {
    const session = await Session.create(TEST_DIR, 'default');
    await session.append({ id: 'msg-1', role: 'user', content: 'hello' });

    const sessionDir = join(TEST_DIR, '.wardayacode');
    expect(existsSync(sessionDir)).toBe(true);
  });

  it('getMessages() returns messages in order', async () => {
    const session = await Session.create(TEST_DIR, 'default');
    await session.append({ id: 'a', role: 'user', content: 'first' });
    await session.append({ id: 'b', role: 'assistant', content: 'second' });

    const messages = session.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0]!.content).toBe('first');
    expect(messages[1]!.content).toBe('second');
  });

  it('load() reads existing JSONL and populates messages', async () => {
    // Create a session, write messages, then load a new Session instance over the same file
    const sessionId = 'test-load-session';
    const sessionDir = join(TEST_DIR, '.wardayacode');
    await mkdir(sessionDir, { recursive: true });

    const filePath = join(sessionDir, `${sessionId}.jsonl`);
    const msg = { id: 'x', role: 'user', content: 'loaded msg', timestamp: Date.now() };
    await writeFile(filePath, JSON.stringify(msg) + '\n');

    const session = new Session(sessionId, TEST_DIR, 'default');
    await session.load();

    const messages = session.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe('loaded msg');
  });

  it('load() skips corrupt JSONL lines without throwing', async () => {
    const sessionId = 'test-corrupt-session';
    const sessionDir = join(TEST_DIR, '.wardayacode');
    await mkdir(sessionDir, { recursive: true });

    const filePath = join(sessionDir, `${sessionId}.jsonl`);
    const valid = JSON.stringify({ id: 'ok', role: 'user', content: 'good', timestamp: 1 });
    await writeFile(filePath, `${valid}\nnot-valid-json\n`);

    const session = new Session(sessionId, TEST_DIR, 'default');
    await expect(session.load()).resolves.toBeUndefined();

    const messages = session.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]!.id).toBe('ok');
  });

  it('load() succeeds when file does not exist (new session)', async () => {
    const session = new Session('nonexistent-id', TEST_DIR, 'default');
    await expect(session.load()).resolves.toBeUndefined();
    expect(session.getMessages()).toHaveLength(0);
  });

  it('export() returns markdown with role headings and content', async () => {
    const session = await Session.create(TEST_DIR, 'default');
    await session.append({ id: '1', role: 'user', content: 'hello world' });
    await session.append({ id: '2', role: 'assistant', content: 'hi there' });

    const md = await session.export();
    expect(md).toContain('# Session');
    expect(md).toContain('USER');
    expect(md).toContain('ASSISTANT');
    expect(md).toContain('hello world');
    expect(md).toContain('hi there');
    expect(md).toContain('Permission Mode:');
    expect(md).toContain('default');
  });
});

describe('SessionManager', () => {
  it('list() returns empty array when session dir does not exist', async () => {
    const manager = new SessionManager(join(TEST_DIR, 'nonexistent'));
    const sessions = await manager.list();
    expect(sessions).toEqual([]);
  });

  it('list() returns sessions with correct metadata', async () => {
    const session = await Session.create(TEST_DIR, 'default');
    await session.append({ id: 'a', role: 'user', content: 'hello' });
    await session.append({ id: 'b', role: 'assistant', content: 'hi' });

    const manager = new SessionManager(TEST_DIR);
    const sessions = await manager.list();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe(session.getId());
    expect(sessions[0]!.messageCount).toBe(2);
    expect(sessions[0]!.sizeBytes).toBeGreaterThan(0);
  });

  it('list() includes firstMessage from first user message', async () => {
    const session = await Session.create(TEST_DIR, 'default');
    await session.append({ id: 'a', role: 'user', content: 'what is the answer?' });

    const manager = new SessionManager(TEST_DIR);
    const sessions = await manager.list();

    expect(sessions[0]!.firstMessage).toBe('what is the answer?');
  });

  it('list() truncates firstMessage to 80 chars', async () => {
    const session = await Session.create(TEST_DIR, 'default');
    await session.append({ id: 'a', role: 'user', content: 'x'.repeat(120) });

    const manager = new SessionManager(TEST_DIR);
    const sessions = await manager.list();

    expect(sessions[0]!.firstMessage!.length).toBe(80);
  });

  it('list() sorts sessions newest-first', async () => {
    const s1 = await Session.create(TEST_DIR, 'default');
    await session_append(s1, 'msg1');

    // Small delay to ensure different mtime
    await new Promise(r => setTimeout(r, 10));

    const s2 = await Session.create(TEST_DIR, 'default');
    await session_append(s2, 'msg2');

    const manager = new SessionManager(TEST_DIR);
    const sessions = await manager.list();

    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.id).toBe(s2.getId());
    expect(sessions[1]!.id).toBe(s1.getId());
  });

  it('delete() removes the session file and returns true', async () => {
    const session = await Session.create(TEST_DIR, 'default');
    await session.append({ id: 'a', role: 'user', content: 'test' });

    const manager = new SessionManager(TEST_DIR);
    const result = await manager.delete(session.getId());

    expect(result).toBe(true);

    const sessions = await manager.list();
    expect(sessions).toHaveLength(0);
  });

  it('delete() returns false for non-existent session', async () => {
    const manager = new SessionManager(TEST_DIR);
    const result = await manager.delete('nonexistent-id');
    expect(result).toBe(false);
  });
});

// Helper for list() sort test
async function session_append(session: Session, content: string): Promise<void> {
  await session.append({ id: crypto.randomUUID(), role: 'user', content });
}
