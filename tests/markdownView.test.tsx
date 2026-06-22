import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MarkdownView } from '../src/ui/components/MarkdownView.js';

describe('MarkdownView', () => {
  it('strips inline markup and preserves the text', () => {
    const { lastFrame } = render(
      <MarkdownView
        content="Run `npm test`, it is **important** and *fast*."
        color="#E0E0E0"
        codeColor="#C084FC"
      />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('Run npm test, it is important and fast.');
    expect(out).not.toContain('**');
    expect(out).not.toContain('`');
  });

  it('renders a bullet for list items and strips the dash', () => {
    const { lastFrame } = render(
      <MarkdownView content={'- first\n- second'} color="#E0E0E0" />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('• first');
    expect(out).toContain('• second');
  });

  it('renders fenced code verbatim without inline parsing', () => {
    const { lastFrame } = render(
      <MarkdownView content={'```\nconst x = **not bold**;\n```'} color="#E0E0E0" />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('const x = **not bold**;');
  });
});
