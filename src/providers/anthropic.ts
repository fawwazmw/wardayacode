import { createAnthropic } from '@ai-sdk/anthropic';
import { wrapLanguageModel, type LanguageModel } from 'ai';
import type { ProviderConfig } from './index.js';
import { resolveProviderApiKey } from './providerAuth.js';
import { stripReasoningMiddleware } from './stripReasoningMiddleware.js';

export function createAnthropicProvider(config: ProviderConfig): LanguageModel {
  const anthropic = createAnthropic({
    apiKey: resolveProviderApiKey(config),
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });

  return wrapLanguageModel({
    model: anthropic(config.model),
    middleware: stripReasoningMiddleware,
  });
}
