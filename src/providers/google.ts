import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { wrapLanguageModel, type LanguageModel } from 'ai';
import type { ProviderConfig } from './index.js';
import { resolveProviderApiKey } from './providerAuth.js';
import { stripReasoningMiddleware } from './stripReasoningMiddleware.js';

export function createGoogleProvider(config: ProviderConfig): LanguageModel {
  const google = createGoogleGenerativeAI({
    apiKey: resolveProviderApiKey(config),
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });

  return wrapLanguageModel({
    model: google(config.model),
    middleware: stripReasoningMiddleware,
  });
}
