import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { UndoManager } from '../src/tools/UndoManager.js';

const TEST_DIR = join(tmpdir(), 'wardayacode-undo-test-' + Date.now());

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('UndoManager', () => {
  it('saves and restores file content', async () => {
    const manager = new UndoManager();
    const filePath = join(TEST_DIR, 'test.txt');
    await writeFile(filePath, 'original content');

    await manager.saveSnapshot(filePath, 'edit_file');
    await writeFile(filePath, 'modified content');

    const result = await manager.undo();
    expect(result).not.toBeNull();
    expect(result!.filePath).toBe(filePath);
    expect(result!.toolName).toBe('edit_file');

    const restored = await readFile(filePath, 'utf-8');
    expect(restored).toBe('original content');
  });

  it('handles new file (stores empty)', async () => {
    const manager = new UndoManager();
    const filePath = join(TEST_DIR, 'new-file.txt');

    await manager.saveSnapshot(filePath, 'write_file');
    await writeFile(filePath, 'new content');

    const result = await manager.undo();
    expect(result).not.toBeNull();

    const restored = await readFile(filePath, 'utf-8');
    expect(restored).toBe('');
  });

  it('returns null when nothing to undo', async () => {
    const manager = new UndoManager();
    const result = await manager.undo();
    expect(result).toBeNull();
  });

  it('tracks stack size', async () => {
    const manager = new UndoManager();
    expect(manager.getStackSize()).toBe(0);

    const filePath = join(TEST_DIR, 'test.txt');
    await writeFile(filePath, 'content');
    await manager.saveSnapshot(filePath, 'edit_file');

    expect(manager.getStackSize()).toBe(1);
  });

  it('undoes in LIFO order', async () => {
    const manager = new UndoManager();
    const file1 = join(TEST_DIR, 'file1.txt');
    const file2 = join(TEST_DIR, 'file2.txt');

    await writeFile(file1, 'first');
    await writeFile(file2, 'second');

    await manager.saveSnapshot(file1, 'edit_file');
    await manager.saveSnapshot(file2, 'edit_file');

    const result1 = await manager.undo();
    expect(result1!.filePath).toBe(file2);

    const result2 = await manager.undo();
    expect(result2!.filePath).toBe(file1);
  });
});
