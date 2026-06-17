/**
 * Core type definitions for wardayacode
 */

// ─── Provider Types ───────────────────────────────────────────────────────────

export type ProviderName = 'anthropic' | 'openai' | 'google';

export interface ProviderConfig {
  provider: ProviderName;
  model: string;
  apiKey?: string;
  apiKeys?: Partial<Record<ProviderName, string>>;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
}

// ─── Tool System Types ────────────────────────────────────────────────────────

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  description?: string;
}

export interface JSONSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: JSONSchemaProperty;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  concurrency: 'concurrent' | 'exclusive';
  requiresPermission: boolean;
}

export interface ToolUse {
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  content?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ─── Permission System Types ──────────────────────────────────────────────────

export type PermissionMode = 'default' | 'plan' | 'acceptEdits' | 'auto' | 'internal';

export interface PermissionRule {
  tool: string;
  action: 'allow' | 'deny';
  pattern?: string;
  reason?: string;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

// ─── Message Types ────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  type?: 'text' | 'tool_use' | 'tool_result';
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: ToolResult;
  timestamp: number;
}

export interface CompactedContext {
  messages: Message[];
  tokenCount: number;
  compactionLayers: number[];
}

// ─── Session Types ────────────────────────────────────────────────────────────

export interface SessionInfo {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  provider: ProviderName;
  model: string;
}

export interface SessionMessage {
  id: string;
  timestamp: number;
  role: MessageRole;
  content: string;
  type?: 'text' | 'tool_use' | 'tool_result';
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: ToolResult;
  metadata?: Record<string, unknown>;
}

// ─── Agent Event Types ────────────────────────────────────────────────────────

export type AgentEventType =
  | 'text-delta'
  | 'tool-call-start'
  | 'tool-call-result'
  | 'error'
  | 'done'
  | 'thinking';

export interface AgentEvent {
  type: AgentEventType;
  data: AgentEventData;
}

export type AgentEventData =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call-start'; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-call-result'; toolName: string; result: ToolResult }
  | { type: 'error'; error: string }
  | { type: 'done'; totalTokens?: number }
  | { type: 'thinking'; text: string };

// ─── Hook System Types ────────────────────────────────────────────────────────

export type HookEvent =
  | 'preToolUse'
  | 'postToolUse'
  | 'sessionStart'
  | 'sessionEnd'
  | 'userPromptSubmit'
  | 'preCompact'
  | 'stop'
  | 'notification';

export interface HookContext {
  event: HookEvent;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: ToolResult;
  sessionId?: string;
  [key: string]: unknown;
}

export interface Hook {
  event: HookEvent;
  handler: (context: HookContext) => Promise<HookResult>;
  priority?: number;
}

export interface HookResult {
  proceed: boolean;
  reason?: string;
  modifiedInput?: Record<string, unknown>;
}

// ─── Skill System Types ───────────────────────────────────────────────────────

export interface Skill {
  name: string;
  description: string;
  content: string;
  triggers?: string[];
}

// ─── Configuration Types ──────────────────────────────────────────────────────

export interface WardayaCodeConfig {
  provider: ProviderName;
  model: string;
  apiKey?: string;
  apiKeys?: Partial<Record<ProviderName, string>>;
  baseURL?: string;
  maxTokens: number;
  temperature: number;
  permissionMode: PermissionMode;
  theme: 'dark' | 'light';
  sessionDir: string;
  systemPrompt?: string;
}
