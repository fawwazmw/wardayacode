import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { ProviderConfig } from './index.js';
import { resolveProviderApiKey } from './providerAuth.js';

export function createGoogleProvider(config: ProviderConfig): LanguageModel {
  const google = createGoogleGenerativeAI({
    apiKey: resolveProviderApiKey(config),
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });

  return google(config.model);
}
