import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the options each SDK factory is constructed with, so we can assert
// that baseURL (and apiKey) are threaded through correctly.
const capture: { anthropic?: unknown; openai?: unknown; google?: unknown } = {};

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: (opts: unknown) => {
    capture.anthropic = opts;
    return (model: string) => ({ model });
  },
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (opts: unknown) => {
    capture.openai = opts;
    return (model: string) => ({ model });
  },
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: (opts: unknown) => {
    capture.google = opts;
    return (model: string) => ({ model });
  },
}));

const { createProvider } = await import('../src/providers/index.js');

beforeEach(() => {
  capture.anthropic = undefined;
  capture.openai = undefined;
  capture.google = undefined;
});

describe('createProvider baseURL threading', () => {
  it('passes baseURL to the anthropic SDK when set', () => {
    createProvider({
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      apiKey: 'k',
      baseURL: 'https://proxy.example/',
    });
    expect(capture.anthropic).toMatchObject({ baseURL: 'https://proxy.example/' });
  });

  it('omits baseURL when not set', () => {
    createProvider({ provider: 'anthropic', model: 'claude-opus-4-8', apiKey: 'k' });
    expect((capture.anthropic as Record<string, unknown>).baseURL).toBeUndefined();
  });

  it('passes baseURL to the openai SDK when set', () => {
    createProvider({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'k',
      baseURL: 'https://oai-proxy.example/',
    });
    expect(capture.openai).toMatchObject({ baseURL: 'https://oai-proxy.example/' });
  });

  it('passes baseURL to the google SDK when set', () => {
    createProvider({
      provider: 'google',
      model: 'gemini-2.0-flash',
      apiKey: 'k',
      baseURL: 'https://g-proxy.example/',
    });
    expect(capture.google).toMatchObject({ baseURL: 'https://g-proxy.example/' });
  });

  it('resolves the provider-specific apiKey alongside baseURL', () => {
    createProvider({
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      apiKeys: { anthropic: 'specific-key' },
      baseURL: 'https://proxy.example/',
    });
    expect(capture.anthropic).toMatchObject({
      apiKey: 'specific-key',
      baseURL: 'https://proxy.example/',
    });
  });
});
