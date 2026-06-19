import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import os from 'node:os';

// We mock os.homedir() to redirect config writes to a temp dir.
// The mock must be in place before the module is imported so cosmiconfig
// and path helpers pick up the temp path.
const TEST_HOME = join(tmpdir(), 'wardayacode-config-test-' + Date.now());

vi.spyOn(os, 'homedir').mockReturnValue(TEST_HOME);

// Import AFTER the spy is set up
const { loadConfig, setProviderApiKey, clearProviderApiKey, listProviderAuthStatus, isAuthProvider, getProviderEnvVarName } = await import('../src/config/index.js');

beforeEach(async () => {
  await mkdir(join(TEST_HOME, '.config', 'wardayacode'), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_HOME, { recursive: true, force: true });
  // Restore env vars mutated by tests
  delete process.env['ANTHROPIC_API_KEY'];
  delete process.env['OPENAI_API_KEY'];
  delete process.env['GOOGLE_GENERATIVE_AI_API_KEY'];
});

describe('loadConfig', () => {
  it('returns DEFAULT_CONFIG when no overrides', async () => {
    const config = await loadConfig();
    expect(config.provider).toBe('anthropic');
    expect(config.maxTokens).toBe(8192);
    expect(config.temperature).toBe(0);
    expect(config.permissionMode).toBe('default');
    expect(config.maxRetries).toBe(3);
  });

  it('applies CLI overrides', async () => {
    const config = await loadConfig({ model: 'gpt-4o', provider: 'openai', maxTokens: 4096 });
    expect(config.model).toBe('gpt-4o');
    expect(config.provider).toBe('openai');
    expect(config.maxTokens).toBe(4096);
  });

  it('CLI overrides win over defaults', async () => {
    const config = await loadConfig({ temperature: 0.7 });
    expect(config.temperature).toBe(0.7);
  });
});

describe('setProviderApiKey', () => {
  it('throws on empty key', async () => {
    await expect(setProviderApiKey('anthropic', '')).rejects.toThrow('API key cannot be empty');
  });

  it('throws on whitespace-only key', async () => {
    await expect(setProviderApiKey('anthropic', '   ')).rejects.toThrow('API key cannot be empty');
  });

  it('writes key to user config file', async () => {
    await setProviderApiKey('anthropic', 'sk-ant-test123');

    const configPath = join(TEST_HOME, '.config', 'wardayacode', 'config.json');
    const content = JSON.parse(await readFile(configPath, 'utf-8')) as { apiKeys: Record<string, string> };
    expect(content.apiKeys['anthropic']).toBe('sk-ant-test123');
  });

  it('preserves existing keys when adding a new one', async () => {
    await setProviderApiKey('anthropic', 'sk-ant-1');
    await setProviderApiKey('openai', 'sk-openai-1');

    const configPath = join(TEST_HOME, '.config', 'wardayacode', 'config.json');
    const content = JSON.parse(await readFile(configPath, 'utf-8')) as { apiKeys: Record<string, string> };
    expect(content.apiKeys['anthropic']).toBe('sk-ant-1');
    expect(content.apiKeys['openai']).toBe('sk-openai-1');
  });
});

describe('clearProviderApiKey', () => {
  it('returns false when key is not set', async () => {
    const result = await clearProviderApiKey('anthropic');
    expect(result).toBe(false);
  });

  it('removes the key and returns true', async () => {
    await setProviderApiKey('anthropic', 'sk-ant-test');
    const result = await clearProviderApiKey('anthropic');
    expect(result).toBe(true);

    const configPath = join(TEST_HOME, '.config', 'wardayacode', 'config.json');
    const content = JSON.parse(await readFile(configPath, 'utf-8')) as { apiKeys: Record<string, string> };
    expect(content.apiKeys['anthropic']).toBeUndefined();
  });
});

describe('listProviderAuthStatus', () => {
  it('reports source=none when not configured', async () => {
    const status = await listProviderAuthStatus();
    const anthropic = status.find(s => s.provider === 'anthropic')!;
    expect(anthropic.configured).toBe(false);
    expect(anthropic.source).toBe('none');
  });

  it('reports source=config when key in user config file', async () => {
    await setProviderApiKey('openai', 'sk-openai-test');
    const status = await listProviderAuthStatus();
    const openai = status.find(s => s.provider === 'openai')!;
    expect(openai.configured).toBe(true);
    expect(openai.source).toBe('config');
  });

  it('reports source=env when key in environment variable', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-env-test';
    const status = await listProviderAuthStatus();
    const anthropic = status.find(s => s.provider === 'anthropic')!;
    expect(anthropic.configured).toBe(true);
    expect(anthropic.source).toBe('env');
  });

  it('returns status for all 3 providers', async () => {
    const status = await listProviderAuthStatus();
    const providers = status.map(s => s.provider);
    expect(providers).toContain('anthropic');
    expect(providers).toContain('openai');
    expect(providers).toContain('google');
  });
});

describe('isAuthProvider', () => {
  it('returns true for known providers', () => {
    expect(isAuthProvider('anthropic')).toBe(true);
    expect(isAuthProvider('openai')).toBe(true);
    expect(isAuthProvider('google')).toBe(true);
  });

  it('returns false for unknown values', () => {
    expect(isAuthProvider('bedrock')).toBe(false);
    expect(isAuthProvider('')).toBe(false);
    expect(isAuthProvider('claude')).toBe(false);
  });
});

describe('getProviderEnvVarName', () => {
  it('maps anthropic to ANTHROPIC_API_KEY', () => {
    expect(getProviderEnvVarName('anthropic')).toBe('ANTHROPIC_API_KEY');
  });

  it('maps openai to OPENAI_API_KEY', () => {
    expect(getProviderEnvVarName('openai')).toBe('OPENAI_API_KEY');
  });

  it('maps google to GOOGLE_GENERATIVE_AI_API_KEY', () => {
    expect(getProviderEnvVarName('google')).toBe('GOOGLE_GENERATIVE_AI_API_KEY');
  });
});
