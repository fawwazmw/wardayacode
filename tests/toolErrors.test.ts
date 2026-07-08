import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), 'wardayacode-tool-errors-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

// ─── BashTool ──────────────────────────────────────────────────────────────

describe('BashTool', () => {
  it('reports missing command input', async () => {
    const { BashTool } = await import('../src/tools/BashTool.js');
    const tool = new BashTool(testDir);
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required field');
  });

  it('blocks destructive commands', async () => {
    const { BashTool } = await import('../src/tools/BashTool.js');
    const tool = new BashTool(testDir);
    const result = await tool.execute({ command: 'rm -rf /' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked');
  });
});

// ─── GrepTool ──────────────────────────────────────────────────────────────

describe('GrepTool', () => {
  it('reports missing pattern', async () => {
    const { GrepTool } = await import('../src/tools/GrepTool.js');
    const tool = new GrepTool(testDir);
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/missing|required/i);
  });

  it('reports path escape', async () => {
    const { GrepTool } = await import('../src/tools/GrepTool.js');
    const tool = new GrepTool(testDir);
    const result = await tool.execute({ pattern: 'test', path: '/etc' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Path escape');
  });

  it('reports invalid regex with valid path inside rootDir', async () => {
    const { GrepTool } = await import('../src/tools/GrepTool.js');
    const tool = new GrepTool(testDir);
    const result = await tool.execute({ pattern: '[invalid', path: testDir });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid regex');
  });

  it('returns no matches when pattern not found', async () => {
    writeFileSync(join(testDir, 'test.txt'), 'hello world\n');
    const { GrepTool } = await import('../src/tools/GrepTool.js');
    const tool = new GrepTool(testDir);
    const result = await tool.execute({ pattern: 'zzzz', path: testDir });
    expect(result.success).toBe(true);
    expect(result.content).toContain('No matches found');
  });

  it('finds pattern matches', async () => {
    writeFileSync(join(testDir, 'test.txt'), 'hello world\nfoo bar\n');
    const { GrepTool } = await import('../src/tools/GrepTool.js');
    const tool = new GrepTool(testDir);
    const result = await tool.execute({ pattern: 'hello', path: testDir });
    expect(result.success).toBe(true);
    expect(result.content).toContain('test.txt:1:');
  });
});

// ─── ListFilesTool ─────────────────────────────────────────────────────────

describe('ListFilesTool', () => {
  it('reports path escape', async () => {
    const { ListFilesTool } = await import('../src/tools/ListFilesTool.js');
    const tool = new ListFilesTool(testDir);
    const result = await tool.execute({ path: '/etc' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Path escape');
  });

  it('reports non-existent directory', async () => {
    const { ListFilesTool } = await import('../src/tools/ListFilesTool.js');
    const tool = new ListFilesTool(testDir);
    const result = await tool.execute({ path: join(testDir, 'nonexistent') });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found|ENOENT/i);
  });

  it('reports empty directory', async () => {
    const emptyDir = join(testDir, 'empty');
    mkdirSync(emptyDir);
    const { ListFilesTool } = await import('../src/tools/ListFilesTool.js');
    const tool = new ListFilesTool(testDir);
    const result = await tool.execute({ path: emptyDir });
    expect(result.success).toBe(true);
    expect(result.content).toContain('empty');
  });

  it('lists files in directory', async () => {
    writeFileSync(join(testDir, 'a.txt'), 'a');
    writeFileSync(join(testDir, 'b.txt'), 'b');
    const { ListFilesTool } = await import('../src/tools/ListFilesTool.js');
    const tool = new ListFilesTool(testDir);
    const result = await tool.execute({ path: testDir });
    expect(result.success).toBe(true);
    expect(result.content).toContain('a.txt');
    expect(result.content).toContain('b.txt');
  });
});

// ─── WriteFileTool ─────────────────────────────────────────────────────────

describe('WriteFileTool', () => {
  it('reports missing input', async () => {
    const { WriteFileTool } = await import('../src/tools/WriteFileTool.js');
    const tool = new WriteFileTool(testDir);
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required');
  });

  it('writes a file successfully', async () => {
    const { WriteFileTool } = await import('../src/tools/WriteFileTool.js');
    const tool = new WriteFileTool(testDir);
    const filePath = join(testDir, 'out.txt');
    const result = await tool.execute({ filePath, content: 'hello' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('Wrote');
  });

  it('reports path escape', async () => {
    const { WriteFileTool } = await import('../src/tools/WriteFileTool.js');
    const tool = new WriteFileTool(testDir);
    const result = await tool.execute({ filePath: '/etc/passwd', content: 'x' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Path escape');
  });
});

// ─── GlobTool ──────────────────────────────────────────────────────────────

describe('GlobTool', () => {
  it('reports missing pattern', async () => {
    const { GlobTool } = await import('../src/tools/GlobTool.js');
    const tool = new GlobTool(testDir);
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/missing|required/i);
  });

  it('reports path escape', async () => {
    const { GlobTool } = await import('../src/tools/GlobTool.js');
    const tool = new GlobTool(testDir);
    const result = await tool.execute({ pattern: '*', path: '/etc' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Path escape');
  });

  it('returns no matches for non-existent pattern', async () => {
    const { GlobTool } = await import('../src/tools/GlobTool.js');
    const tool = new GlobTool(testDir);
    const result = await tool.execute({ pattern: 'nonexistent-*.xyz', path: testDir });
    expect(result.success).toBe(true);
    expect(result.content).toContain('No files matched');
  });

  it('finds matching files', async () => {
    writeFileSync(join(testDir, 'test.ts'), '');
    writeFileSync(join(testDir, 'other.js'), '');
    const { GlobTool } = await import('../src/tools/GlobTool.js');
    const tool = new GlobTool(testDir);
    const result = await tool.execute({ pattern: '*.ts', path: testDir });
    expect(result.success).toBe(true);
    expect(result.content).toContain('test.ts');
  });
});

// ─── ReadFileTool ──────────────────────────────────────────────────────────

describe('ReadFileTool', () => {
  it('reports missing filePath', async () => {
    const { ReadFileTool } = await import('../src/tools/ReadFileTool.js');
    const tool = new ReadFileTool(testDir);
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/missing|required/i);
  });

  it('reports path escape', async () => {
    const { ReadFileTool } = await import('../src/tools/ReadFileTool.js');
    const tool = new ReadFileTool(testDir);
    const result = await tool.execute({ filePath: '/etc/passwd' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Path escape');
  });

  it('reports file not found', async () => {
    const { ReadFileTool } = await import('../src/tools/ReadFileTool.js');
    const tool = new ReadFileTool(testDir);
    const result = await tool.execute({ filePath: join(testDir, 'does-not-exist.txt') });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found|ENOENT/i);
  });

  it('reads a file successfully', async () => {
    writeFileSync(join(testDir, 'read-me.txt'), 'line1\nline2\nline3\n');
    const { ReadFileTool } = await import('../src/tools/ReadFileTool.js');
    const tool = new ReadFileTool(testDir);
    const result = await tool.execute({ filePath: join(testDir, 'read-me.txt') });
    expect(result.success).toBe(true);
    expect(result.content).toContain('1: line1');
    expect(result.content).toContain('2: line2');
  });
});

// ─── EditFileTool ──────────────────────────────────────────────────────────

describe('EditFileTool', () => {
  it('reports missing fields', async () => {
    const { EditFileTool } = await import('../src/tools/EditFileTool.js');
    const tool = new EditFileTool(testDir);
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/missing|required/i);
  });

  it('reports oldString not found', async () => {
    writeFileSync(join(testDir, 'edit-me.txt'), 'hello world');
    const { EditFileTool } = await import('../src/tools/EditFileTool.js');
    const tool = new EditFileTool(testDir);
    const result = await tool.execute({
      filePath: join(testDir, 'edit-me.txt'),
      oldString: 'zzzz',
      newString: 'yyyy',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('reports file not found', async () => {
    const { EditFileTool } = await import('../src/tools/EditFileTool.js');
    const tool = new EditFileTool(testDir);
    const result = await tool.execute({
      filePath: join(testDir, 'nonexistent.txt'),
      oldString: 'foo',
      newString: 'bar',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found|ENOENT/i);
  });

  it('edits a file successfully', async () => {
    writeFileSync(join(testDir, 'edit-me.txt'), 'hello world foo bar');
    const { EditFileTool } = await import('../src/tools/EditFileTool.js');
    const tool = new EditFileTool(testDir);
    const result = await tool.execute({
      filePath: join(testDir, 'edit-me.txt'),
      oldString: 'world',
      newString: 'there',
    });
    expect(result.success).toBe(true);
    expect(result.content).toContain('Edited');
  });
});
