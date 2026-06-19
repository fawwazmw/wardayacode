import { createOpenAI } from '@ai-sdk/openai';
import { wrapLanguageModel, type LanguageModel } from 'ai';
import type { ProviderConfig } from './index.js';
import { resolveProviderApiKey } from './providerAuth.js';
import { stripReasoningMiddleware } from './stripReasoningMiddleware.js';

export function createOpenAIProvider(config: ProviderConfig): LanguageModel {
  const openai = createOpenAI({
    apiKey: resolveProviderApiKey(config),
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });

  return wrapLanguageModel({
    model: openai(config.model),
    middleware: stripReasoningMiddleware,
  });
}
