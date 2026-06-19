import path from 'path';
import os from 'os';
import type { PermissionMode } from '../types.js';

export interface WardayaCodeConfig {
  provider: 'anthropic' | 'openai' | 'google';
  model: string;
  apiKey?: string;
  apiKeys?: Partial<Record<'anthropic' | 'openai' | 'google', string>>;
  baseURL?: string;
  maxTokens: number;
  temperature: number;
  permissionMode: PermissionMode;
  theme: 'dark' | 'light';
  sessionDir: string;
  systemPrompt?: string;
  maxRetries: number;
}

export const DEFAULT_CONFIG: WardayaCodeConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKeys: {},
  maxTokens: 8192,
  temperature: 0,
  permissionMode: 'default',
  theme: 'dark',
  sessionDir: path.join(os.homedir(), '.config', 'wardayacode', 'sessions'),
  maxRetries: 3,
};
