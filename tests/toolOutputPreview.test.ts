import { previewToolOutput } from '../src/utils/toolOutputPreview.js';

describe('previewToolOutput', () => {
  it('returns all lines when under the cap', () => {
    const result = previewToolOutput('a\nb\nc', 4);
    expect(result.lines).toEqual(['a', 'b', 'c']);
    expect(result.hiddenCount).toBe(0);
  });

  it('returns all lines when exactly at the cap', () => {
    const result = previewToolOutput('a\nb\nc\nd', 4);
    expect(result.lines).toEqual(['a', 'b', 'c', 'd']);
    expect(result.hiddenCount).toBe(0);
  });

  it('caps lines and reports the hidden count', () => {
    const result = previewToolOutput('1\n2\n3\n4\n5\n6\n7\n8\n9\n10', 4);
    expect(result.lines).toEqual(['1', '2', '3', '4']);
    expect(result.hiddenCount).toBe(6);
  });

  it('drops trailing blank lines before counting', () => {
    const result = previewToolOutput('a\nb\n\n\n', 4);
    expect(result.lines).toEqual(['a', 'b']);
    expect(result.hiddenCount).toBe(0);
  });

  it('does not count a single trailing newline as a hidden line', () => {
    const result = previewToolOutput('1\n2\n3\n4\n', 4);
    expect(result.lines).toEqual(['1', '2', '3', '4']);
    expect(result.hiddenCount).toBe(0);
  });

  it('returns no lines for empty content', () => {
    expect(previewToolOutput('', 4)).toEqual({ lines: [], hiddenCount: 0 });
  });

  it('returns no lines for whitespace-only content', () => {
    expect(previewToolOutput('   \n  \n', 4)).toEqual({ lines: [], hiddenCount: 0 });
  });

  it('handles a single line', () => {
    const result = previewToolOutput('just one line', 4);
    expect(result.lines).toEqual(['just one line']);
    expect(result.hiddenCount).toBe(0);
  });

  it('hides everything when maxLines is zero', () => {
    const result = previewToolOutput('a\nb\nc', 0);
    expect(result.lines).toEqual([]);
    expect(result.hiddenCount).toBe(3);
  });

  it('preserves interior blank lines', () => {
    const result = previewToolOutput('a\n\nb', 4);
    expect(result.lines).toEqual(['a', '', 'b']);
    expect(result.hiddenCount).toBe(0);
  });
});
