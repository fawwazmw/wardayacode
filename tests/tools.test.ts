import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ReadFileTool } from '../src/tools/ReadFileTool.js';
import { WriteFileTool } from '../src/tools/WriteFileTool.js';
import { EditFileTool } from '../src/tools/EditFileTool.js';
import { GlobTool } from '../src/tools/GlobTool.js';
import { GrepTool } from '../src/tools/GrepTool.js';
import { ListFilesTool } from '../src/tools/ListFilesTool.js';
import { BashTool } from '../src/tools/BashTool.js';
import { ToolRegistry, registerCoreTools } from '../src/tools/index.js';

const TEST_DIR = join(tmpdir(), 'wardayacode-test-' + Date.now());

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('ToolRegistry', () => {
  it('registers and retrieves all core tools', () => {
    const registry = new ToolRegistry();
    registerCoreTools(registry);

    expect(registry.has('read_file')).toBe(true);
    expect(registry.has('write_file')).toBe(true);
    expect(registry.has('edit_file')).toBe(true);
    expect(registry.has('bash')).toBe(true);
    expect(registry.has('glob')).toBe(true);
    expect(registry.has('grep')).toBe(true);
    expect(registry.has('list_files')).toBe(true);
  });

  it('returns error for unknown tool', async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute('nonexistent', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Tool not found');
  });
});

describe('ReadFileTool', () => {
  const tool = new ReadFileTool(TEST_DIR);

  it('reads a file with line numbers', async () => {
    const filePath = join(TEST_DIR, 'test.txt');
    await writeFile(filePath, 'line1\nline2\nline3\n');

    const result = await tool.execute({ filePath });
    expect(result.success).toBe(true);
    expect(result.content).toContain('1: line1');
    expect(result.content).toContain('2: line2');
    expect(result.content).toContain('3: line3');
  });

  it('supports offset and limit', async () => {
    const filePath = join(TEST_DIR, 'test.txt');
    await writeFile(filePath, 'a\nb\nc\nd\ne\n');

    const result = await tool.execute({ filePath, offset: 2, limit: 2 });
    expect(result.success).toBe(true);
    expect(result.content).toContain('2: b');
    expect(result.content).toContain('3: c');
    expect(result.content).not.toContain('1: a');
  });

  it('returns error for missing file', async () => {
    const result = await tool.execute({ filePath: join(TEST_DIR, 'nope.txt') });
    expect(result.success).toBe(false);
    expect(result.error).toContain('File not found');
  });

  it('returns error for directory path', async () => {
    const result = await tool.execute({ filePath: TEST_DIR });
    expect(result.success).toBe(false);
    expect(result.error).toContain('directory');
  });
});

describe('WriteFileTool', () => {
  const tool = new WriteFileTool(TEST_DIR);

  it('writes a new file', async () => {
    const filePath = join(TEST_DIR, 'output.txt');
    const result = await tool.execute({ filePath, content: 'hello world' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('output.txt');
  });

  it('creates parent directories', async () => {
    const filePath = join(TEST_DIR, 'deep', 'nested', 'file.txt');
    const result = await tool.execute({ filePath, content: 'nested content' });
    expect(result.success).toBe(true);
  });
});

describe('EditFileTool', () => {
  const tool = new EditFileTool(TEST_DIR);

  it('replaces a unique string', async () => {
    const filePath = join(TEST_DIR, 'edit.txt');
    await writeFile(filePath, 'hello world\nfoo bar\n');

    const result = await tool.execute({
      filePath,
      oldString: 'foo bar',
      newString: 'baz qux',
    });
    expect(result.success).toBe(true);
  });

  it('fails on non-unique match without replaceAll', async () => {
    const filePath = join(TEST_DIR, 'dup.txt');
    await writeFile(filePath, 'aaa\naaa\n');

    const result = await tool.execute({
      filePath,
      oldString: 'aaa',
      newString: 'bbb',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('matches');
  });

  it('replaces all with replaceAll flag', async () => {
    const filePath = join(TEST_DIR, 'dup.txt');
    await writeFile(filePath, 'aaa\naaa\n');

    const result = await tool.execute({
      filePath,
      oldString: 'aaa',
      newString: 'bbb',
      replaceAll: true,
    });
    expect(result.success).toBe(true);
  });

  it('fails when oldString not found', async () => {
    const filePath = join(TEST_DIR, 'edit.txt');
    await writeFile(filePath, 'hello world\n');

    const result = await tool.execute({
      filePath,
      oldString: 'not here',
      newString: 'replacement',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('GlobTool', () => {
  const tool = new GlobTool(TEST_DIR);

  it('finds files by pattern', async () => {
    await writeFile(join(TEST_DIR, 'a.ts'), '');
    await writeFile(join(TEST_DIR, 'b.ts'), '');
    await writeFile(join(TEST_DIR, 'c.js'), '');

    const result = await tool.execute({ pattern: '*.ts', path: TEST_DIR });
    expect(result.success).toBe(true);
    expect(result.content).toContain('a.ts');
    expect(result.content).toContain('b.ts');
    expect(result.content).not.toContain('c.js');
  });

  it('returns empty message for no matches', async () => {
    const result = await tool.execute({ pattern: '*.xyz', path: TEST_DIR });
    expect(result.success).toBe(true);
    expect(result.content).toContain('No files matched');
  });
});

describe('GrepTool', () => {
  const tool = new GrepTool(TEST_DIR);

  it('finds matching lines', async () => {
    await writeFile(join(TEST_DIR, 'search.ts'), 'const foo = 1;\nconst bar = 2;\nconst foobar = 3;\n');

    const result = await tool.execute({ pattern: 'foo', path: TEST_DIR, include: '*.ts' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('foo');
    expect(result.metadata?.matchCount).toBeGreaterThanOrEqual(2);
  });

  it('returns no matches message', async () => {
    await writeFile(join(TEST_DIR, 'empty.ts'), 'nothing here\n');

    const result = await tool.execute({ pattern: 'zzzzz', path: TEST_DIR });
    expect(result.success).toBe(true);
    expect(result.content).toContain('No matches');
  });

  it('rejects invalid regex', async () => {
    const result = await tool.execute({ pattern: '[invalid', path: TEST_DIR });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid regex');
  });
});

describe('ListFilesTool', () => {
  const tool = new ListFilesTool(TEST_DIR);

  it('lists directory contents', async () => {
    await writeFile(join(TEST_DIR, 'file1.txt'), '');
    await mkdir(join(TEST_DIR, 'subdir'));

    const result = await tool.execute({ path: TEST_DIR });
    expect(result.success).toBe(true);
    expect(result.content).toContain('file1.txt');
    expect(result.content).toContain('subdir/');
  });

  it('returns error for non-directory', async () => {
    const filePath = join(TEST_DIR, 'notdir.txt');
    await writeFile(filePath, '');

    const result = await tool.execute({ path: filePath });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not a directory');
  });
});

describe('BashTool', () => {
  const tool = new BashTool();

  it('executes a simple command', async () => {
    const result = await tool.execute({ command: 'echo hello' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('hello');
  });

  it('captures exit code on failure', async () => {
    const result = await tool.execute({ command: 'exit 1' });
    expect(result.success).toBe(false);
    expect(result.metadata?.exitCode).toBe(1);
  });

  it('respects workdir option', async () => {
    const result = await tool.execute({ command: 'pwd', workdir: TEST_DIR });
    expect(result.success).toBe(true);
    expect(result.content).toContain(TEST_DIR);
  });

  it('times out long commands', async () => {
    const result = await tool.execute({ command: 'sleep 10', timeout: 100 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  }, 5000);

  it('runs commands with CI=true so watch-mode runners exit on their own', async () => {
    const result = await tool.execute({ command: 'echo "CI=$CI"' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('CI=true');
  });

  it('forces a non-interactive pager', async () => {
    const result = await tool.execute({ command: 'echo "PAGER=$PAGER"' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('PAGER=cat');
  });
});
