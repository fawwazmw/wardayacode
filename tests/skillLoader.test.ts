import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { loadSkills, formatSkillsForPrompt } from '../src/extensibility/skillLoader.js';

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wardaya-skills-'));
  await fs.mkdir(path.join(tmpRoot, '.wardayacode', 'skills'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('loadSkills', () => {
  it('returns an empty array when no skill dir exists', async () => {
    const emptyRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wardaya-noskills-'));
    const skills = await loadSkills(emptyRoot);
    // The user-level dir may or may not exist; only assert project skills are absent.
    expect(skills.some(s => s.source.startsWith(emptyRoot))).toBe(false);
    await fs.rm(emptyRoot, { recursive: true, force: true });
  });

  it('loads .md skills from the project directory', async () => {
    const dir = path.join(tmpRoot, '.wardayacode', 'skills');
    await fs.writeFile(path.join(dir, 'testing.md'), '# Testing Guide\n\nAlways write tests.\n');
    await fs.writeFile(path.join(dir, 'notes.txt'), 'ignored');

    const skills = await loadSkills(tmpRoot);
    const testing = skills.find(s => s.name === 'testing');
    expect(testing).toBeDefined();
    expect(testing!.description).toBe('Testing Guide');
    expect(testing!.content).toContain('Always write tests.');
    expect(skills.find(s => s.name === 'notes')).toBeUndefined();
  });

  it('parses triggers and falls back to the first non-heading line', async () => {
    const dir = path.join(tmpRoot, '.wardayacode', 'skills');
    await fs.writeFile(
      path.join(dir, 'deploy.md'),
      'triggers: deploy, release\n\nShip it carefully.\n',
    );
    const skills = await loadSkills(tmpRoot);
    const deploy = skills.find(s => s.name === 'deploy');
    expect(deploy).toBeDefined();
    expect(deploy!.triggers).toEqual(['deploy', 'release']);
    expect(deploy!.description).toBe('Ship it carefully.');
  });
});

describe('formatSkillsForPrompt', () => {
  it('returns empty string for no skills', () => {
    expect(formatSkillsForPrompt([])).toBe('');
  });

  it('includes name, description, and content', () => {
    const out = formatSkillsForPrompt([
      { name: 'testing', description: 'Testing Guide', content: 'Always write tests.' },
    ]);
    expect(out).toContain('Available Skills');
    expect(out).toContain('## testing');
    expect(out).toContain('Testing Guide');
    expect(out).toContain('Always write tests.');
  });

  it('caps total size and notes omitted skills', () => {
    const big = 'x'.repeat(5_000);
    const out = formatSkillsForPrompt([
      { name: 'a', description: 'A', content: big, source: '/tmp/a.md' },
      { name: 'b', description: 'B', content: big, source: '/tmp/b.md' },
      { name: 'c', description: 'C', content: big, source: '/tmp/c.md' },
    ]);
    expect(out).toContain('content omitted');
    expect(out).toContain('/tmp/c.md');
  });
});
