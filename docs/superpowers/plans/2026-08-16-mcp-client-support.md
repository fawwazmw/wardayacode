# MCP Client Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give WardayaCode a real MCP client so it can connect to local stdio MCP servers and expose their tools to the agent.

**Architecture:** Use the official `@modelcontextprotocol/sdk`. A new `McpManager` loads server configs (`.mcp.json` + `.wardayacode/mcp/*.json`), connects on-demand via `StdioClientTransport`, and registers each discovered MCP tool as an `McpTool` (a `Tool` subclass) into the existing `ToolRegistry`. All MCP tools are permission-gated via a wildcard `mcp__*` deny rule.

**Tech Stack:** TypeScript (ESM, `.js` import extensions), `@modelcontextprotocol/sdk`, Vitest, existing `Tool`/`ToolRegistry`/`PermissionSystem` infrastructure.

## Global Constraints

- All internal imports use `.js` extensions (e.g. `import { Tool } from '../tools/Tool.js'`)
- `noUncheckedIndexedAccess` is on — guard array/object index access with `??` or non-null assertion
- Vitest globals enabled — `describe`, `it`, `expect`, `vi`, `beforeEach` available without imports
- Every task ends with all existing tests passing + new tests green, and a commit
- MCP tools always require permission — never auto-approved, even in `auto` mode
- Tool naming: `mcp__<server>__<tool>`
- Config: `.mcp.json` (project root) wins over `.wardayacode/mcp/*.json` on name collisions

---

### Task 1: MCP Config Loading

**Files:**
- Modify: `package.json` (add `@modelcontextprotocol/sdk` dependency)
- Create: `src/mcp/config.ts`
- Test: `tests/mcpConfig.test.ts`

**Interfaces:**
- Produces: `McpServerConfig` interface, `loadMcpConfig(projectRoot: string): Promise<Map<string, McpServerConfig>>`

- [ ] **Step 1: Add the MCP SDK dependency**

Run: `npm install @modelcontextprotocol/sdk@^1.0.0`

Expected: package.json gains `"@modelcontextprotocol/sdk": "^1.0.0"` and node_modules installs it.

- [ ] **Step 2: Write the failing test**

Create `tests/mcpConfig.test.ts`:

```typescript
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadMcpConfig } from '../src/mcp/config.js';

describe('loadMcpConfig', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcp-config-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads servers from .mcp.json', async () => {
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify({
      mcpServers: {
        filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'], env: {} },
      },
    }));
    const servers = await loadMcpConfig(dir);
    expect(servers.get('filesystem')?.command).toBe('npx');
    expect(servers.get('filesystem')?.args).toContain('@modelcontextprotocol/server-filesystem');
  });

  it('loads servers from .wardayacode/mcp/*.json', async () => {
    const mcpDir = join(dir, '.wardayacode', 'mcp');
    mkdirSync(mcpDir, { recursive: true });
    writeFileSync(join(mcpDir, 'github.json'), JSON.stringify({
      name: 'github',
      command: 'node',
      args: ['server.js'],
      env: { GITHUB_TOKEN: 'abc' },
    }));
    const servers = await loadMcpConfig(dir);
    expect(servers.get('github')?.command).toBe('node');
    expect(servers.get('github')?.env.GITHUB_TOKEN).toBe('abc');
  });

  it('lets .mcp.json win on name collisions', async () => {
    const mcpDir = join(dir, '.wardayacode', 'mcp');
    mkdirSync(mcpDir, { recursive: true });
    writeFileSync(join(mcpDir, 'filesystem.json'), JSON.stringify({
      name: 'filesystem', command: 'old-cmd', args: [], env: {},
    }));
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify({
      mcpServers: { filesystem: { command: 'new-cmd', args: [], env: {} } },
    }));
    const servers = await loadMcpConfig(dir);
    expect(servers.get('filesystem')?.command).toBe('new-cmd');
  });

  it('skips servers without a command', async () => {
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify({
      mcpServers: { broken: { args: [] }, good: { command: 'cmd', args: [] } },
    }));
    const servers = await loadMcpConfig(dir);
    expect(servers.has('broken')).toBe(false);
    expect(servers.get('good')?.command).toBe('cmd');
  });

  it('returns empty map when no config exists', async () => {
    const servers = await loadMcpConfig(dir);
    expect(servers.size).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/mcpConfig.test.ts`
Expected: FAIL — "Cannot find module '../src/mcp/config.js'"

- [ ] **Step 4: Write minimal implementation**

Create `src/mcp/config.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * Load MCP server configs from .wardayacode/mcp/*.json and .mcp.json
 * (project root), merged. .mcp.json wins on name collisions. Servers
 * without a command are skipped.
 */
export async function loadMcpConfig(projectRoot: string): Promise<Map<string, McpServerConfig>> {
  const servers = new Map<string, McpServerConfig>();

  // 1. .wardayacode/mcp/*.json — one server per file
  const mcpDir = path.join(projectRoot, '.wardayacode', 'mcp');
  try {
    const files = (await fs.readdir(mcpDir)).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = await fs.readFile(path.join(mcpDir, file), 'utf-8');
        const cfg = JSON.parse(raw) as Partial<McpServerConfig>;
        if (!cfg.command || typeof cfg.command !== 'string') continue;
        const name = cfg.name ?? file.replace('.json', '');
        servers.set(name, {
          name,
          command: cfg.command,
          args: cfg.args ?? [],
          env: cfg.env ?? {},
        });
      } catch {
        // skip unreadable/invalid config file
      }
    }
  } catch {
    // no .wardayacode/mcp directory — ignore
  }

  // 2. .mcp.json — wins on name collisions
  try {
    const raw = await fs.readFile(path.join(projectRoot, '.mcp.json'), 'utf-8');
    const parsed = JSON.parse(raw) as {
      mcpServers?: Record<string, { command?: string; args?: string[]; env?: Record<string, string> }>;
    };
    for (const [name, cfg] of Object.entries(parsed.mcpServers ?? {})) {
      if (!cfg?.command) continue;
      servers.set(name, {
        name,
        command: cfg.command,
        args: cfg.args ?? [],
        env: cfg.env ?? {},
      });
    }
  } catch {
    // no .mcp.json — ignore
  }

  return servers;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/mcpConfig.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/mcp/config.ts tests/mcpConfig.test.ts
git commit -m "feat: MCP server config loading"
```

---

### Task 2: McpTool + McpManager (+ ToolRegistry.unregister)

**Files:**
- Create: `src/mcp/McpTool.ts`
- Create: `src/mcp/McpManager.ts`
- Modify: `src/tools/ToolRegistry.ts`
- Test: `tests/mcpTool.test.ts`
- Test: `tests/mcpManager.test.ts`
- Test: `tests/toolRegistry.test.ts`

**Interfaces:**
- Consumes: `McpServerConfig` from `./config.js` (Task 1), `ToolRegistry` (needs `unregister`, added in this task)
- Produces:
  - `ToolRegistry.unregister(name: string): void`
  - `class McpTool extends Tool` — constructor `(manager, server: string, toolName: string, description: string, inputSchema: Record<string, unknown>)`; `definition.name` = `mcp__<server>__<toolName>`
  - `class McpManager` — constructor `(registry: ToolRegistry)`; methods `loadConfig(projectRoot): Promise<void>`, `getConfigNames(): string[]`, `getStatus(): McpServerStatus[]`, `connect(name): Promise<string>`, `disconnect(name): Promise<string>`, `disconnectAll(): Promise<void>`, `callTool(server, tool, args): Promise<ToolResult>`

- [ ] **Step 1: Write the failing tests**

Create `tests/mcpTool.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { McpTool } from '../src/mcp/McpTool.js';

const mockCallTool = vi.fn();

class MockManager {
  callTool = mockCallTool;
}

describe('McpTool', () => {
  it('builds a namespaced definition', () => {
    const tool = new McpTool(new MockManager() as never, 'github', 'create_issue', 'Creates an issue', {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    });
    expect(tool.definition.name).toBe('mcp__github__create_issue');
    expect(tool.definition.description).toBe('Creates an issue');
    expect(tool.definition.requiresPermission).toBe(true);
    expect(tool.definition.concurrency).toBe('concurrent');
  });

  it('delegates execute to the manager callTool', async () => {
    mockCallTool.mockResolvedValue({ success: true, content: 'done' });
    const tool = new McpTool(new MockManager() as never, 'github', 'create_issue', '', { type: 'object' });
    const result = await tool.execute({ title: 'Bug' });
    expect(mockCallTool).toHaveBeenCalledWith('github', 'create_issue', { title: 'Bug' });
    expect(result.success).toBe(true);
  });
});
```

Create `tests/mcpManager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClientCtor = vi.fn();
const mockTransportCtor = vi.fn();

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: mockClientCtor,
}));
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: mockTransportCtor,
}));

vi.mock('../src/mcp/config.js', () => ({
  loadMcpConfig: vi.fn(),
}));

import { McpManager } from '../src/mcp/McpManager.js';
import { loadMcpConfig } from '../src/mcp/config.js';

const mockLoadMcpConfig = loadMcpConfig as ReturnType<typeof vi.fn>;

class MockRegistry {
  registered: string[] = [];
  register(t: { definition: { name: string } }): void {
    this.registered.push(t.definition.name);
  }
  unregister(name: string): void {
    this.registered = this.registered.filter(n => n !== name);
  }
}

describe('McpManager', () => {
  let manager: McpManager;
  let registry: MockRegistry;
  let clientInstance: {
    connect: ReturnType<typeof vi.fn>;
    listTools: ReturnType<typeof vi.fn>;
    callTool: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MockRegistry();
    clientInstance = {
      connect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'read', description: 'Read', inputSchema: { type: 'object' } }] }),
      callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'hello' }] }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mockClientCtor.mockImplementation(() => clientInstance);
    mockTransportCtor.mockImplementation(() => ({ start: vi.fn(), close: vi.fn() }));
    mockLoadMcpConfig.mockResolvedValue(new Map([
      ['filesystem', { name: 'filesystem', command: 'npx', args: ['-y', 'server-fs'], env: {} }],
    ]));
    manager = new McpManager(registry as never);
  });

  it('loads config names', async () => {
    await manager.loadConfig('/tmp/project');
    expect(manager.getConfigNames()).toEqual(['filesystem']);
  });

  it('connects a server and registers its tools', async () => {
    await manager.loadConfig('/tmp/project');
    const msg = await manager.connect('filesystem');
    expect(msg).toContain('Connected to filesystem');
    expect(msg).toContain('1 tools');
    expect(registry.registered).toEqual(['mcp__filesystem__read']);
    expect(clientInstance.connect).toHaveBeenCalled();
    expect(clientInstance.listTools).toHaveBeenCalled();
  });

  it('reports status connected/disconnected', async () => {
    await manager.loadConfig('/tmp/project');
    expect(manager.getStatus()[0]?.status).toBe('disconnected');
    await manager.connect('filesystem');
    expect(manager.getStatus()[0]?.status).toBe('connected');
    expect(manager.getStatus()[0]?.toolCount).toBe(1);
  });

  it('disconnects and unregisters tools', async () => {
    await manager.loadConfig('/tmp/project');
    await manager.connect('filesystem');
    const msg = await manager.disconnect('filesystem');
    expect(msg).toContain('Disconnected');
    expect(registry.registered).toEqual([]);
    expect(clientInstance.close).toHaveBeenCalled();
  });

  it('returns error when calling tool on disconnected server', async () => {
    await manager.loadConfig('/tmp/project');
    const result = await manager.callTool('filesystem', 'read', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('not connected');
  });

  it('translates callTool result to ToolResult', async () => {
    await manager.loadConfig('/tmp/project');
    await manager.connect('filesystem');
    const result = await manager.callTool('filesystem', 'read', { path: '/tmp' });
    expect(result).toEqual({ success: true, content: 'hello' });
  });

  it('translates isError to failure', async () => {
    await manager.loadConfig('/tmp/project');
    await manager.connect('filesystem');
    clientInstance.callTool.mockResolvedValue({ content: [{ type: 'text', text: 'boom' }], isError: true });
    const result = await manager.callTool('filesystem', 'read', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('handles connect failure gracefully', async () => {
    await manager.loadConfig('/tmp/project');
    clientInstance.connect.mockRejectedValue(new Error('spawn failed'));
    const msg = await manager.connect('filesystem');
    expect(msg).toContain('Failed to connect');
    expect(registry.registered).toEqual([]);
  });

  it('disconnectAll closes everything', async () => {
    await manager.loadConfig('/tmp/project');
    await manager.connect('filesystem');
    await manager.disconnectAll();
    expect(clientInstance.close).toHaveBeenCalled();
    expect(manager.getStatus()[0]?.status).toBe('disconnected');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/mcpTool.test.ts tests/mcpManager.test.ts`
Expected: FAIL — "Cannot find module '../src/mcp/McpTool.js'" / "../src/mcp/McpManager.js"

- [ ] **Step 3: Write minimal implementation**

Create `src/mcp/McpTool.ts`:

```typescript
import { Tool } from '../tools/Tool.js';
import type { ToolDefinition, ToolResult } from '../types.js';
import type { McpManager } from './McpManager.js';

/** A Tool that delegates execution to an MCP server via McpManager. */
export class McpTool extends Tool {
  definition: ToolDefinition;

  private manager: McpManager;
  private server: string;
  private toolName: string;

  constructor(
    manager: McpManager,
    server: string,
    toolName: string,
    description: string,
    inputSchema: Record<string, unknown>,
  ) {
    super();
    this.manager = manager;
    this.server = server;
    this.toolName = toolName;
    this.definition = {
      name: `mcp__${server}__${toolName}`,
      description,
      inputSchema: inputSchema as ToolDefinition['inputSchema'],
      concurrency: 'concurrent',
      requiresPermission: true,
    };
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return this.manager.callTool(this.server, this.toolName, input);
  }
}
```

Create `src/mcp/McpManager.ts`:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { ToolResult } from '../types.js';
import type { McpServerConfig } from './config.js';
import { loadMcpConfig } from './config.js';
import { McpTool } from './McpTool.js';

export interface McpServerStatus {
  name: string;
  status: 'connected' | 'disconnected';
  toolCount: number;
}

interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpConnection {
  config: McpServerConfig;
  client: Client;
  tools: McpToolInfo[];
}

/**
 * Manages MCP server connections and exposes their tools to the
 * ToolRegistry. Servers connect on demand via `connect(name)`.
 */
export class McpManager {
  private registry: ToolRegistry;
  private configs = new Map<string, McpServerConfig>();
  private connections = new Map<string, McpConnection>();

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  async loadConfig(projectRoot: string): Promise<void> {
    this.configs = await loadMcpConfig(projectRoot);
  }

  getConfigNames(): string[] {
    return [...this.configs.keys()];
  }

  getStatus(): McpServerStatus[] {
    return [...this.configs.keys()].map(name => {
      const conn = this.connections.get(name);
      return {
        name,
        status: conn ? 'connected' : 'disconnected',
        toolCount: conn?.tools.length ?? 0,
      };
    });
  }

  async connect(name: string): Promise<string> {
    const config = this.configs.get(name);
    if (!config) return `Unknown MCP server: ${name}`;
    if (this.connections.has(name)) return `Server "${name}" is already connected.`;

    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });
      const client = new Client({ name: 'wardayacode', version: '0.6.1' });
      await client.connect(transport);

      const { tools } = await client.listTools();
      const toolInfos: McpToolInfo[] = tools.map(t => ({
        name: t.name,
        description: t.description ?? '',
        inputSchema: t.inputSchema as Record<string, unknown>,
      }));

      this.connections.set(name, { config, client, tools: toolInfos });

      for (const t of toolInfos) {
        this.registry.register(new McpTool(this, name, t.name, t.description, t.inputSchema));
      }

      return `Connected to ${name} (${toolInfos.length} tools).`;
    } catch (error) {
      this.connections.delete(name);
      return `Failed to connect to ${name}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async disconnect(name: string): Promise<string> {
    const conn = this.connections.get(name);
    if (!conn) return `Server "${name}" is not connected.`;

    for (const t of conn.tools) {
      this.registry.unregister(`mcp__${name}__${t.name}`);
    }

    try {
      await conn.client.close();
    } catch {
      // ignore close errors
    }
    this.connections.delete(name);
    return `Disconnected from ${name}.`;
  }

  async disconnectAll(): Promise<void> {
    for (const name of [...this.connections.keys()]) {
      await this.disconnect(name);
    }
  }

  async callTool(server: string, tool: string, args: Record<string, unknown>): Promise<ToolResult> {
    const conn = this.connections.get(server);
    if (!conn) {
      return { success: false, error: `MCP server "${server}" is not connected.` };
    }
    try {
      const result = await conn.client.callTool({ name: tool, arguments: args });
      const text = extractText(result.content);
      if (result.isError) {
        return { success: false, error: text || 'MCP tool returned an error.' };
      }
      return { success: true, content: text || '(no output)' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

function extractText(content: Array<{ type?: string; text?: string }>): string {
  return content
    .filter(c => c.type === 'text' && c.text)
    .map(c => c.text)
    .join('\n');
}
```

Note: `McpTool` imports `McpManager` as a type only, so the circular import between the two files is safe at runtime.

- [ ] **Step 4: Add ToolRegistry.unregister (needed by McpManager.disconnect)**

Modify `src/tools/ToolRegistry.ts` — add the method after the existing `list()` method:

```typescript
  /**
   * Remove a registered tool
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }
```

Add a test to `tests/toolRegistry.test.ts` (append inside the existing top-level `describe`):

```typescript
  it('unregister removes a tool', () => {
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    expect(registry.has('echo')).toBe(true);
    registry.unregister('echo');
    expect(registry.has('echo')).toBe(false);
    expect(registry.getAvailableTools().length).toBe(0);
  });
```

> `EchoTool` is the concrete `Tool` subclass already defined at the top of `tests/toolRegistry.test.ts`.

- [ ] **Step 5: Run tests and type-check to verify they pass**

Run: `npx vitest run tests/mcpTool.test.ts tests/mcpManager.test.ts tests/toolRegistry.test.ts`
Expected: PASS (11 + 1 = 12 tests)

Run: `npm run type-check`
Expected: PASS — no errors (unregister now exists on `ToolRegistry`, so `McpManager` compiles)

- [ ] **Step 6: Commit**

```bash
git add src/mcp/McpTool.ts src/mcp/McpManager.ts src/tools/ToolRegistry.ts tests/mcpTool.test.ts tests/mcpManager.test.ts tests/toolRegistry.test.ts
git commit -m "feat: MCP manager and tool adapter"
```

---

### Task 3: PermissionSystem MCP Rule

**Files:**
- Modify: `src/permissions/PermissionSystem.ts`
- Test: `tests/permissions.test.ts`

**Interfaces:**
- Produces: `mcp__*` deny rule in `PermissionSystem` for all modes; wildcard tool-name matching via `minimatch`

- [ ] **Step 1: Write the failing tests**

Add to `tests/permissions.test.ts` (append inside the existing top-level `describe`):

```typescript
  it('denies mcp__* tools and prompts', async () => {
    const perms = new PermissionSystem('default');
    const prompt = vi.fn().mockResolvedValue('deny');
    perms.setPromptHandler(prompt);
    const result = await perms.check({ name: 'mcp__github__create_issue', input: {} });
    expect(result.allowed).toBe(false);
    expect(prompt).toHaveBeenCalledWith('mcp__github__create_issue', {}, expect.any(String));
  });

  it('denies mcp__* tools even in auto mode', async () => {
    const perms = new PermissionSystem('auto');
    const prompt = vi.fn().mockResolvedValue('deny');
    perms.setPromptHandler(prompt);
    const result = await perms.check({ name: 'mcp__filesystem__read', input: {} });
    expect(result.allowed).toBe(false);
    expect(prompt).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/permissions.test.ts`
Expected: FAIL — `mcp__*` tool allowed (no deny rule matches) in default and auto modes

- [ ] **Step 3: Write minimal implementation**

Modify `src/permissions/PermissionSystem.ts`:

In `loadDefaultRules()`, after the `switch (this.mode)` block, add the MCP deny rule so it applies to every mode:

```typescript
    // MCP tools always require permission, in every mode
    this.rules.unshift({ tool: 'mcp__*', action: 'deny', reason: 'MCP tools require approval' });
```

Modify `matchesRule()` to support wildcards in the tool name (it currently only supports exact match or `'*'`):

```typescript
  private matchesRule(toolUse: ToolUse, rule: PermissionRule): boolean {
    if (rule.tool !== '*') {
      if (rule.tool.includes('*')) {
        if (!minimatch(toolUse.name, rule.tool)) {
          return false;
        }
      } else if (rule.tool !== toolUse.name) {
        return false;
      }
    }

    if (rule.pattern && toolUse.input?.path) {
      const path = String(toolUse.input.path);
      if (!minimatch(path, rule.pattern)) {
        return false;
      }
    }

    return true;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/permissions.test.ts`
Expected: PASS (existing + 2 new tests)

- [ ] **Step 5: Run full suite to confirm nothing broke**

Run: `npm run test:run`
Expected: PASS — all test files green

- [ ] **Step 6: Commit**

```bash
git add src/permissions/PermissionSystem.ts tests/permissions.test.ts
git commit -m "feat: MCP permission rule"
```

---

### Task 4: CLI Wiring

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `McpManager` from `src/mcp/McpManager.js` (Task 2)
- Produces: `App` gains a `mcpManager: McpManager` prop

- [ ] **Step 1: Write the implementation**

Modify `src/cli.ts`:

1. Add the import (near the other tool/permission imports):

```typescript
import { McpManager } from './mcp/McpManager.js';
```

2. In `run()`, after `const toolRegistry = new ToolRegistry();` and `registerCoreTools(toolRegistry, undoManager);`, create and configure the manager:

```typescript
  const mcpManager = new McpManager(toolRegistry);
  await mcpManager.loadConfig(projectRoot);
```

(Place this after `const projectRoot = process.cwd();` so `projectRoot` is in scope.)

3. Pass `mcpManager` to `runTUI` — add it to the `runTUI` call and signature, then to the `App` props:

```typescript
    runTUI(agent, session, config, model, undoManager, checkpoint, permissions, mcpManager, currentVersion, initialPrompt);
```

```typescript
function runTUI(
  agent: Agent,
  session: Session,
  config: { model: string; permissionMode: PermissionMode; theme: 'dark' | 'light' },
  languageModel: LanguageModel,
  undoManager: UndoManager,
  checkpoint: Checkpoint,
  permissions: PermissionSystem,
  mcpManager: McpManager,
  version: string,
  initialPrompt?: string
): void {
```

4. In the `App` element creation, add the prop:

```typescript
        mcpManager,
```

Modify `src/ui/App.tsx`:

1. Add the import and prop type:

```typescript
import type { McpManager } from '../mcp/McpManager.js';
```

```typescript
interface AppProps {
  agent: Agent;
  session: Session;
  model: string;
  languageModel?: LanguageModel;
  mcpManager?: McpManager;
  ...
}
```

2. Destructure `mcpManager` in the function signature:

```typescript
export function App({
  agent,
  session,
  model,
  languageModel,
  mcpManager,
  ...
}: AppProps): React.ReactElement {
```

- [ ] **Step 2: Run type-check and tests**

Run: `npm run type-check && npm run test:run`
Expected: PASS — no type errors, all 440+ existing tests green (no new tests for this wiring task; it's verified by type-check)

- [ ] **Step 3: Commit**

```bash
git add src/cli.ts src/ui/App.tsx
git commit -m "feat: wire McpManager into CLI and App"
```

---

### Task 5: /mcp Command

**Files:**
- Modify: `src/ui/SlashCommands.ts`
- Modify: `src/ui/App.tsx`
- Modify: `tests/slashCommands.test.ts`

**Interfaces:**
- Consumes: `McpManager` prop from App (Task 4)
- Produces: `SlashCommandContext` methods `mcpList()`, `mcpConnect(name)`, `mcpDisconnect(name)`, `mcpStatus()` (replacing `scanMcpConfigs`)

- [ ] **Step 1: Write the failing test**

Modify `tests/slashCommands.test.ts` — update `createMockContext` to replace `scanMcpConfigs` with the new methods:

```typescript
    mcpList: vi.fn().mockResolvedValue('Configured: filesystem'),
    mcpConnect: vi.fn().mockResolvedValue('Connected to filesystem (1 tools).'),
    mcpDisconnect: vi.fn().mockResolvedValue('Disconnected from filesystem.'),
    mcpStatus: vi.fn().mockResolvedValue('  filesystem  — disconnected (0 tools)'),
```

Add these tests inside the existing `describe('handleSlashCommand')`:

```typescript
  it('handles /mcp with no args as status', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/mcp', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.mcpStatus).toHaveBeenCalled();
  });

  it('handles /mcp list', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/mcp list', ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain('Configured: filesystem');
  });

  it('handles /mcp connect <name>', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/mcp connect filesystem', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.mcpConnect).toHaveBeenCalledWith('filesystem');
    expect(result.output).toContain('Connected to filesystem');
  });

  it('handles /mcp disconnect <name>', async () => {
    const ctx = createMockContext();
    const result = await handleSlashCommand('/mcp disconnect filesystem', ctx);
    expect(result.handled).toBe(true);
    expect(ctx.mcpDisconnect).toHaveBeenCalledWith('filesystem');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/slashCommands.test.ts`
Expected: FAIL — `scanMcpConfigs` removed from context, `/mcp` not routing to new methods

- [ ] **Step 3: Write minimal implementation**

Modify `src/ui/SlashCommands.ts`:

1. In the `SlashCommandContext` interface, replace `scanMcpConfigs` with:

```typescript
  /** List configured MCP servers. */
  mcpList: () => Promise<string>;
  /** Connect an MCP server by name. */
  mcpConnect: (name: string) => Promise<string>;
  /** Disconnect an MCP server by name. */
  mcpDisconnect: (name: string) => Promise<string>;
  /** Show MCP server connection status. */
  mcpStatus: () => Promise<string>;
```

2. Replace the `/mcp` case:

```typescript
    case '/mcp': {
      if (arg === 'list') {
        return { handled: true, output: await ctx.mcpList() };
      }
      if (arg === 'connect' && parts[2]) {
        return { handled: true, output: await ctx.mcpConnect(parts[2]!) };
      }
      if (arg === 'disconnect' && parts[2]) {
        return { handled: true, output: await ctx.mcpDisconnect(parts[2]!) };
      }
      return { handled: true, output: await ctx.mcpStatus() };
    }
```

Modify `src/ui/App.tsx` — in the `handleSubmit` context object, replace the `scanMcpConfigs` method with:

```typescript
      mcpList: async () => {
        if (!mcpManager) return 'MCP not available in this context.';
        const names = mcpManager.getConfigNames();
        if (names.length === 0) {
          return 'No MCP servers configured.\nAdd .mcp.json or .wardayacode/mcp/*.json.';
        }
        return `Configured MCP servers:\n  ${names.join('\n  ')}\nUse /mcp connect <name> to connect.`;
      },
      mcpConnect: async (name: string) => {
        if (!mcpManager) return 'MCP not available in this context.';
        return mcpManager.connect(name);
      },
      mcpDisconnect: async (name: string) => {
        if (!mcpManager) return 'MCP not available in this context.';
        return mcpManager.disconnect(name);
      },
      mcpStatus: async () => {
        if (!mcpManager) return 'MCP not available in this context.';
        const statuses = mcpManager.getStatus();
        if (statuses.length === 0) return 'No MCP servers configured.';
        const lines = statuses.map(s =>
          `  ${s.name.padEnd(20)} ${s.status === 'connected' ? '✓ connected' : '— disconnected'} (${s.toolCount} tools)`,
        );
        return `MCP servers:\n${lines.join('\n')}`;
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/slashCommands.test.ts`
Expected: PASS (existing + 4 new tests)

- [ ] **Step 5: Run full suite + type-check**

Run: `npm run type-check && npm run test:run`
Expected: PASS — all tests green, no type errors

- [ ] **Step 6: Commit**

```bash
git add src/ui/SlashCommands.ts src/ui/App.tsx tests/slashCommands.test.ts
git commit -m "feat: /mcp command management"
```

---

## Self-Review Notes

- **Spec coverage:** config loading (T1), McpTool/McpManager lifecycle (T2), permission gating (T3), CLI wiring (T4), `/mcp` command (T5). Server crash handling is implemented in T2 via `connections.delete` on connect failure and empty-tool handling in `callTool`. Tool timeout is delegated to the SDK's internal handling and surfaced via `callTool`'s catch → error result.
- **Type consistency:** `McpServerConfig`, `McpServerStatus`, `callTool(server, tool, args)` signatures used identically across T1, T2, and T5. `ToolRegistry.unregister(name)` defined in T3, consumed by T2's runtime code and T2's mock.
