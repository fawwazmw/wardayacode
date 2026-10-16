# MCP Client Support — Design

**Date:** 2026-08-16
**Status:** Approved
**Branch:** `feat/welcome-screen-redesign` (to be based on updated `develop`)

## Goal

Give WardayaCode a real Model Context Protocol (MCP) client so it can connect to
local MCP servers over stdio and expose their tools to the agent. This unlocks
the MCP ecosystem (filesystem, databases, GitHub, browsers, etc.) — the biggest
feature-parity gap versus Claude Code.

## Decisions (confirmed with user)

- **Approach:** Official `@modelcontextprotocol/sdk` client
- **Transport:** stdio local servers only (remote HTTP/SSE deferred)
- **Config:** Both `.mcp.json` (project root) and `.wardayacode/mcp/*.json`, merged
- **Security:** All MCP tools require permission approval (never auto-approved)
- **UX:** Enhanced `/mcp` command for management; no auto-connect at startup

## Architecture

```
cli.ts
  → new McpManager()
  → mcpm.loadConfig()        (reads .mcp.json + .wardayacode/mcp/*.json)
  → toolRegistry.registerMcpTools(mcpm)
        │
        ▼
   ToolRegistry (extended)
        │  each McpTool delegates to
        ▼
   McpManager
     ├─ loadConfig()        .mcp.json + .wardayacode/mcp/*.json
     ├─ connect(server)     StdioClientTransport + Client.initialize
     ├─ listTools(server)   MCP tool definitions
     ├─ callTool(server, tool, args)
     └─ disconnectAll()     kill child processes on exit
```

### New files

| File | Responsibility |
|------|----------------|
| `src/mcp/McpManager.ts` | Server lifecycle, tool discovery, tool calling, status tracking |
| `src/mcp/config.ts` | Config loading + merging (`McpServerConfig` type) |
| `src/mcp/McpTool.ts` | `Tool` subclass wrapping one MCP server tool |

### New dependency

- `@modelcontextprotocol/sdk` (official TypeScript SDK)

## Config Format

### `.mcp.json` (project root — multiple servers)

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./data"],
      "env": {}
    }
  }
}
```

### `.wardayacode/mcp/<name>.json` (one server per file)

```json
{
  "name": "github",
  "command": "node",
  "args": ["server.js"],
  "env": { "GITHUB_TOKEN": "..." }
}
```

### Merge rules

- Both sources loaded and combined into `Map<string, McpServerConfig>`
- `.mcp.json` wins on name collisions
- A server without `command` is skipped with a warning

```ts
interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}
```

## Tool Adapter (`McpTool`)

Each tool discovered from an MCP server becomes a `Tool` instance:

| `Tool` field | Value |
|--------------|-------|
| `definition.name` | `mcp__<server>__<tool>` |
| `definition.description` | MCP tool description |
| `definition.inputSchema` | MCP tool's JSONSchema (passthrough) |
| `definition.concurrency` | `'concurrent'` |
| `definition.requiresPermission` | `true` |
| `execute(input)` | `mcpManager.callTool(server, tool, input)` |

`callTool` result translation:
- MCP `isError: true` → `{ success: false, error }`
- MCP text content → `{ success: true, content }`
- Empty result → `{ success: true, content: '(no output)' }`

## Permission Gating

Add a wildcard rule to `PermissionSystem.loadDefaultRules()`:

```ts
{ tool: 'mcp__*', action: 'deny', reason: 'MCP tools require approval' }
```

This rule applies in every mode; because MCP tools always require permission,
their calls always prompt (or hard-deny in `plan`/`--no-tui`).

## Lifecycle

- **Startup:** `cli.ts` instantiates `McpManager` and calls `loadConfig()`. No
  servers are spawned yet — they connect on demand.
- **Registration:** `toolRegistry.registerMcpTools(mcpm)` prepares the hook; tools
  from a server become available only after that server connects.
- **Connect (`/mcp connect <name>`):** spawns the server process, `initialize`
  handshake, `listTools()`, creates `McpTool` instances, registers them.
- **Disconnect (`/mcp disconnect <name>`):** removes that server's tools from the
  registry, terminates its process, marks it disconnected.
- **On exit:** `process.on('exit')` → `mcpm.disconnectAll()` kills any live
  child processes.
- **Server crash mid-session:** marked `disconnected`, its tools removed from the
  registry; `/mcp status` reflects it.

## Error Handling

- Spawn / initialize failure → log + skip that server, continue others
- Tool call timeout → error result to agent (no hang)
- Empty server (no tools) → log, register nothing
- Disconnected server tool call → error result "server not connected"

## `/mcp` Command

The existing scan-only `/mcp` command becomes a management tool:

| Command | Action |
|---------|--------|
| `/mcp` | List servers + connection status |
| `/mcp list` | List discovered tools per connected server |
| `/mcp connect <name>` | Connect/start a server, register its tools |
| `/mcp disconnect <name>` | Disconnect, remove its tools |
| `/mcp status` | Per-server: connected/disconnected, tool count |

Requires new `SlashCommandContext` methods: `mcpList()`, `mcpConnect(name)`,
`mcpDisconnect(name)`, `mcpStatus()` — implemented in `App.tsx`, delegating to
the shared `McpManager`.

## Testing

- **`src/mcp/config.ts`** — unit tests: `.mcp.json` + `.wardayacode/mcp/*.json`
  loading, merging, collision resolution, invalid config skipping
- **`src/mcp/McpTool.ts`** — mock `McpManager`: name mapping, schema passthrough,
  `callTool` delegation, `isError` → `ToolResult` translation
- **`src/mcp/McpManager.ts`** — mock `@modelcontextprotocol/sdk`:
  connect/listTools/disconnectAll lifecycle, spawn failure, crash handling
- **Permission** — verify `mcp__*` wildcard rule denies + prompts
- **`/mcp` command** — verify list/connect/disconnect/status output

## Out of Scope (future work)

- HTTP/SSE and streamable-HTTP transports (remote servers)
- Auto-connect at startup
- Per-server trust-on-connect
- MCP server config editing from the TUI
