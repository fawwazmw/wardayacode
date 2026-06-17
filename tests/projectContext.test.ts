import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gatherProjectContext } from '../src/context/ProjectContext.js';

const TEST_DIR = join(tmpdir(), 'wardayacode-project-test-' + Date.now());

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('gatherProjectContext', () => {
  it('detects node project with package.json', async () => {
    await writeFile(join(TEST_DIR, 'package.json'), JSON.stringify({
      name: 'test-project',
      dependencies: { react: '^18.0.0' },
      devDependencies: { vitest: '^2.0.0' },
    }));

    const info = await gatherProjectContext(TEST_DIR);
    expect(info.type).toBe('node');
    expect(info.name).toBe('test-project');
    expect(info.framework).toBe('React');
    expect(info.testRunner).toBe('vitest');
  });

  it('detects Next.js framework', async () => {
    await writeFile(join(TEST_DIR, 'package.json'), JSON.stringify({
      dependencies: { next: '^14.0.0', react: '^18.0.0' },
    }));

    const info = await gatherProjectContext(TEST_DIR);
    expect(info.framework).toBe('Next.js');
  });

  it('detects TypeScript', async () => {
    await writeFile(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'ts-proj' }));
    await writeFile(join(TEST_DIR, 'tsconfig.json'), '{}');

    const info = await gatherProjectContext(TEST_DIR);
    expect(info.language).toBe('TypeScript');
  });

  it('returns unknown for empty directory', async () => {
    const info = await gatherProjectContext(TEST_DIR);
    expect(info.type).toBe('unknown');
  });

  it('loads WARDAYA.md context file', async () => {
    await writeFile(join(TEST_DIR, 'WARDAYA.md'), 'Always use semicolons.\nPrefer const over let.');

    const info = await gatherProjectContext(TEST_DIR);
    expect(info.contextFileContent).toContain('Always use semicolons');
  });

  it('loads .cursorrules as fallback', async () => {
    await writeFile(join(TEST_DIR, '.cursorrules'), 'Use tabs for indentation.');

    const info = await gatherProjectContext(TEST_DIR);
    expect(info.contextFileContent).toContain('Use tabs');
  });

  it('detects package manager from lockfile', async () => {
    await writeFile(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test' }));
    await writeFile(join(TEST_DIR, 'pnpm-lock.yaml'), '');

    const info = await gatherProjectContext(TEST_DIR);
    expect(info.packageManager).toBe('pnpm');
  });
});
