import { describe, it, expect } from 'vitest';
import { generateDiff } from '../src/tools/DiffView.js';
import stripAnsi from 'strip-ansi';

describe('generateDiff', () => {
  it('shows added lines', () => {
    const old = 'line1\nline2\nline3';
    const newContent = 'line1\nline2\nnew line\nline3';

    const diff = stripAnsi(generateDiff(old, newContent, 'test.ts'));
    expect(diff).toContain('+new line');
  });

  it('shows removed lines', () => {
    const old = 'line1\nline2\nline3';
    const newContent = 'line1\nline3';

    const diff = stripAnsi(generateDiff(old, newContent, 'test.ts'));
    expect(diff).toContain('-line2');
  });

  it('shows no changes for identical content', () => {
    const content = 'same\ncontent';
    const diff = stripAnsi(generateDiff(content, content, 'test.ts'));
    expect(diff).toContain('no changes');
  });

  it('includes file path in header', () => {
    const diff = stripAnsi(generateDiff('old', 'new', 'src/foo.ts'));
    expect(diff).toContain('src/foo.ts');
  });
});
