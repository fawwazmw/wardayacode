import type { ProviderName } from '../types.js';

export const PROVIDER_ENV_VAR: Record<ProviderName, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
};

export interface ProviderAuthConfig {
  provider: ProviderName;
  apiKey?: string;
  apiKeys?: Partial<Record<ProviderName, string>>;
}

export function getProviderEnvVarName(provider: ProviderName): string {
  return PROVIDER_ENV_VAR[provider];
}

export function resolveProviderApiKey(config: ProviderAuthConfig): string | undefined {
  const fromConfig = config.apiKeys?.[config.provider] ?? config.apiKey;
  if (fromConfig) return fromConfig;
  return process.env[getProviderEnvVarName(config.provider)];
}
