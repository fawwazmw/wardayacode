import { describe, it, expect } from 'vitest';
import { parseInlineMarkdown } from '../src/utils/parseInlineMarkdown.js';

describe('parseInlineMarkdown', () => {
  it('returns a single plain segment for text with no markup', () => {
    expect(parseInlineMarkdown('hello world')).toEqual([
      { text: 'hello world' },
    ]);
  });

  it('parses **bold** and strips the asterisks', () => {
    expect(parseInlineMarkdown('this is **important** ok')).toEqual([
      { text: 'this is ' },
      { text: 'important', bold: true },
      { text: ' ok' },
    ]);
  });

  it('parses `code` and strips the backticks', () => {
    expect(parseInlineMarkdown('run `npm test` now')).toEqual([
      { text: 'run ' },
      { text: 'npm test', code: true },
      { text: ' now' },
    ]);
  });

  it('parses *italic* and strips the asterisks', () => {
    expect(parseInlineMarkdown('a *subtle* hint')).toEqual([
      { text: 'a ' },
      { text: 'subtle', italic: true },
      { text: ' hint' },
    ]);
  });

  it('does not treat ** as italic (bold takes precedence)', () => {
    expect(parseInlineMarkdown('**bold**')).toEqual([
      { text: 'bold', bold: true },
    ]);
  });

  it('does not parse markup inside a code span', () => {
    expect(parseInlineMarkdown('`a **b** c`')).toEqual([
      { text: 'a **b** c', code: true },
    ]);
  });

  it('handles multiple segments of mixed types', () => {
    expect(
      parseInlineMarkdown('Run `test`, it is **important** and *fast*.'),
    ).toEqual([
      { text: 'Run ' },
      { text: 'test', code: true },
      { text: ', it is ' },
      { text: 'important', bold: true },
      { text: ' and ' },
      { text: 'fast', italic: true },
      { text: '.' },
    ]);
  });

  it('leaves an unmatched asterisk as plain text', () => {
    expect(parseInlineMarkdown('2 * 3 = 6')).toEqual([{ text: '2 * 3 = 6' }]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseInlineMarkdown('')).toEqual([]);
  });

  it('handles markup at the very start and end of the line', () => {
    expect(parseInlineMarkdown('**a** b `c`')).toEqual([
      { text: 'a', bold: true },
      { text: ' b ' },
      { text: 'c', code: true },
    ]);
  });
});
