import { cosmiconfig } from 'cosmiconfig';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { DEFAULT_CONFIG, type WardayaCodeConfig } from './defaults.js';
import type { ProviderName } from '../types.js';

const MODULE_NAME = 'wardayacode';
const AUTH_PROVIDERS: ProviderName[] = ['anthropic', 'openai', 'google'];
const PROVIDER_ENV_VAR: Record<ProviderName, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
};

export async function loadConfig(
  cliOverrides: Partial<WardayaCodeConfig> = {}
): Promise<WardayaCodeConfig> {
  const explorer = cosmiconfig(MODULE_NAME, {
    searchPlaces: [
      `.${MODULE_NAME}.json`,
      `.${MODULE_NAME}.yaml`,
      `.${MODULE_NAME}.yml`,
      `${MODULE_NAME}.config.ts`,
      `${MODULE_NAME}.config.js`,
      `${MODULE_NAME}.config.mjs`,
    ],
  });

  const userConfig = await loadUserConfig();

  let projectConfig: Partial<WardayaCodeConfig> = {};
  try {
    const result = await explorer.search();
    if (result && !result.isEmpty) {
      projectConfig = result.config as Partial<WardayaCodeConfig>;
    }
  } catch {
    // project config not found
  }

  const merged: WardayaCodeConfig = {
    ...DEFAULT_CONFIG,
    ...stripUndefined(userConfig),
    ...stripUndefined(projectConfig),
    ...stripUndefined(cliOverrides),
    apiKeys: {
      ...(DEFAULT_CONFIG.apiKeys ?? {}),
      ...(userConfig.apiKeys ?? {}),
      ...(projectConfig.apiKeys ?? {}),
      ...(cliOverrides.apiKeys ?? {}),
    },
  };

  return merged;
}

async function loadUserConfig(): Promise<Partial<WardayaCodeConfig>> {
  const userConfigPath = getUserConfigPath();

  try {
    const content = await fs.readFile(userConfigPath, 'utf-8');
    return JSON.parse(content) as Partial<WardayaCodeConfig>;
  } catch {
    return {};
  }
}

export async function saveUserConfig(
  config: Partial<WardayaCodeConfig>
): Promise<void> {
  const configDir = path.join(os.homedir(), '.config', MODULE_NAME);
  const configPath = getUserConfigPath();

  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function isAuthProvider(value: string): value is ProviderName {
  return AUTH_PROVIDERS.includes(value as ProviderName);
}

export function getProviderEnvVarName(provider: ProviderName): string {
  return PROVIDER_ENV_VAR[provider];
}

export async function setProviderApiKey(provider: ProviderName, apiKey: string): Promise<void> {
  const normalized = apiKey.trim();
  if (!normalized) {
    throw new Error('API key cannot be empty');
  }

  const existing = await loadUserConfig();
  const next: Partial<WardayaCodeConfig> = {
    ...existing,
    apiKeys: {
      ...(existing.apiKeys ?? {}),
      [provider]: normalized,
    },
  };

  await saveUserConfig(next);
}

export async function clearProviderApiKey(provider: ProviderName): Promise<boolean> {
  const existing = await loadUserConfig();
  const existingKeys = { ...(existing.apiKeys ?? {}) };

  if (!existingKeys[provider]) {
    return false;
  }

  delete existingKeys[provider];
  const next: Partial<WardayaCodeConfig> = {
    ...existing,
    apiKeys: existingKeys,
  };

  await saveUserConfig(next);
  return true;
}

export interface ProviderAuthStatus {
  provider: ProviderName;
  configured: boolean;
  source: 'config' | 'env' | 'none';
}

export async function listProviderAuthStatus(): Promise<ProviderAuthStatus[]> {
  const userConfig = await loadUserConfig();
  const userKeys = userConfig.apiKeys ?? {};

  return AUTH_PROVIDERS.map((provider) => {
    if (userKeys[provider]) {
      return { provider, configured: true, source: 'config' as const };
    }

    if (process.env[getProviderEnvVarName(provider)]) {
      return { provider, configured: true, source: 'env' as const };
    }

    return { provider, configured: false, source: 'none' as const };
  });
}

export async function getConfigPath(): Promise<string | null> {
  const explorer = cosmiconfig(MODULE_NAME);
  try {
    const result = await explorer.search();
    return result?.filepath ?? null;
  } catch {
    return null;
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

function getUserConfigPath(): string {
  return path.join(os.homedir(), '.config', MODULE_NAME, 'config.json');
}

export { DEFAULT_CONFIG, type WardayaCodeConfig } from './defaults.js';
