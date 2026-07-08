import { describe, it, expect } from 'vitest';

describe('agent/index', () => {
  it('exports Agent class', async () => {
    const mod = await import('../src/agent/index.js');
    expect(mod.Agent).toBeDefined();
    expect(typeof mod.Agent).toBe('function');
  });
});
