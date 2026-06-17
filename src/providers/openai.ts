import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { ProviderConfig } from './index.js';
import { resolveProviderApiKey } from './providerAuth.js';

export function createOpenAIProvider(config: ProviderConfig): LanguageModel {
  const openai = createOpenAI({
    apiKey: resolveProviderApiKey(config),
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });

  return openai(config.model);
}
