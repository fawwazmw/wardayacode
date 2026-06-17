import { describe, it, expect } from 'vitest';
import { getProviderEnvVarName, resolveProviderApiKey } from '../src/providers/providerAuth.js';

describe('providerAuth', () => {
  it('returns expected env var names', () => {
    expect(getProviderEnvVarName('anthropic')).toBe('ANTHROPIC_API_KEY');
    expect(getProviderEnvVarName('openai')).toBe('OPENAI_API_KEY');
    expect(getProviderEnvVarName('google')).toBe('GOOGLE_GENERATIVE_AI_API_KEY');
  });

  it('prefers provider-specific apiKeys over generic apiKey', () => {
    const key = resolveProviderApiKey({
      provider: 'openai',
      apiKey: 'generic-key',
      apiKeys: {
        openai: 'openai-specific-key',
      },
    });

    expect(key).toBe('openai-specific-key');
  });

  it('falls back to generic apiKey when provider-specific key is absent', () => {
    const key = resolveProviderApiKey({
      provider: 'anthropic',
      apiKey: 'generic-key',
      apiKeys: {},
    });

    expect(key).toBe('generic-key');
  });
});
