import type { LanguageModel } from 'ai';
import { createAnthropicProvider } from './anthropic.js';
import { createOpenAIProvider } from './openai.js';
import { createGoogleProvider } from './google.js';

export interface ProviderConfig {
  provider: 'anthropic' | 'openai' | 'google';
  model: string;
  apiKey?: string;
  apiKeys?: Partial<Record<'anthropic' | 'openai' | 'google', string>>;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Create a LanguageModel instance from provider config
 */
export function createProvider(config: ProviderConfig): LanguageModel {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicProvider(config);
    case 'openai':
      return createOpenAIProvider(config);
    case 'google':
      return createGoogleProvider(config);
    default: {
      const exhaustive: never = config.provider;
      throw new Error(`Unknown provider: ${exhaustive}`);
    }
  }
}

export { createAnthropicProvider } from './anthropic.js';
export { createOpenAIProvider } from './openai.js';
export { createGoogleProvider } from './google.js';
export { getProviderEnvVarName, resolveProviderApiKey } from './providerAuth.js';
