import { describe, it, expect } from 'vitest';

describe('providers/index', () => {
  it('exports createProvider function', async () => {
    const mod = await import('../src/providers/index.js');
    expect(typeof mod.createProvider).toBe('function');
  });

  it('throws for unknown provider', async () => {
    const mod = await import('../src/providers/index.js');
    expect(() => mod.createProvider({ provider: 'unknown' as 'anthropic', model: 'test' })).toThrow('Unknown provider');
  });

  it('exports createAnthropicProvider', async () => {
    const mod = await import('../src/providers/index.js');
    expect(typeof mod.createAnthropicProvider).toBe('function');
  });

  it('exports createOpenAIProvider', async () => {
    const mod = await import('../src/providers/index.js');
    expect(typeof mod.createOpenAIProvider).toBe('function');
  });

  it('exports createGoogleProvider', async () => {
    const mod = await import('../src/providers/index.js');
    expect(typeof mod.createGoogleProvider).toBe('function');
  });

  it('exports getProviderEnvVarName', async () => {
    const mod = await import('../src/providers/index.js');
    expect(typeof mod.getProviderEnvVarName).toBe('function');
  });
});
