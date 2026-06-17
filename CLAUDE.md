# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Run from source (tsx, no build required)
npm run build        # Bundle to dist/ via tsup
npm run type-check   # TypeScript strict check (does not emit)
npm run lint         # ESLint on all .ts/.tsx files
npm run lint -- --fix

npm test                           # Vitest watch mode
npm run test:run                   # Single CI run
npm run test:coverage              # With v8 coverage
npm test tests/agent.test.ts       # Single file
npm test -- --reporter=verbose     # Extra output
```

## Architecture

This is a ReAct (Reasoning + Acting) agent loop built on the Vercel AI SDK with a React + Ink terminal UI.

### Data Flow

```
CLI (Commander.js) → loadConfig() → App.tsx (React/Ink)
                                          ↓
                                    Agent.run(messages)
                                     ├─ streamText() [Vercel AI SDK]
                                     │   └─ maxSteps handles multi-turn tool loops natively
                                     ├─ PermissionSystem.check() per tool call
                                     ├─ ToolRegistry.execute()
                                     └─ emits: text-delta | tool-call-start | tool-call-result | error | done
                                          ↓
                                    UI subscribes to Agent events → streaming render
                                          ↓
                                    SessionManager → JSONL append (.wardayacode/)
```

### Key Non-Obvious Details

**Tool execution pipeline** (`src/agent/Agent.ts`): `buildTools()` converts each `ToolDefinition.inputSchema` (plain JSONSchema) to a Zod schema dynamically, then wraps it in a `CoreTool` whose `execute` calls `PermissionSystem.check()` before delegating to `ToolRegistry.execute()`. The LLM never directly invokes tools — everything flows through this permission gate.

**Permission rules** (`src/permissions/PermissionSystem.ts`): Rules are evaluated top-to-bottom; first match wins. `plan` mode hard-denies write/bash tools without prompting the user. All other modes call `promptHandler` on a deny-match, which can return `'allow'`, `'deny'`, or `'always'` (which adds the tool to `sessionAllowList` for the rest of the session). Adding a rule with `addRule()` prepends it (highest priority).

**Config cascade** (`src/config/index.ts`): Merge order is `defaults → ~/.config/wardayacode/config.json → .wardayacode.json (project) → CLI args`. The `apiKeys` object is merged separately so per-provider keys from different layers don't clobber each other. Env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`) are read at provider init time, not during config load.

**ES module imports**: The project uses `"type": "module"` and `"moduleResolution": "bundler"`. All internal imports must use `.js` extensions even though source files are `.ts` (e.g. `import { Foo } from './foo.js'`).

**`noUncheckedIndexedAccess`**: Enabled in tsconfig. Array index access and object property access via bracket notation returns `T | undefined` — always guard or use non-null assertion with justification.

**Vercel AI SDK multi-step loop**: `streamText({ maxSteps })` handles the full tool-call → result → re-prompt cycle natively. The `Agent` class doesn't manually loop; it iterates `result.fullStream` once and the SDK manages re-invocation up to `maxSteps` (default 25).

### Permission Modes

| Mode | Write/Edit | Bash | Prompts user |
|------|-----------|------|--------------|
| `default` | deny→prompt | deny→prompt | yes |
| `plan` | hard deny | hard deny | no |
| `acceptEdits` | allow | deny→prompt | yes |
| `auto` | allow | allow | no |
| `internal` | allow | allow | no |

### Adding a New Tool

1. Extend `Tool` in `src/tools/` — implement `definition` (name, description, inputSchema as JSONSchema) and `execute(input)`
2. Register it in `src/tools/index.ts` via `ToolRegistry`
3. If it needs permission gating, add a rule in `PermissionSystem.loadDefaultRules()` or let it fall through to `{ tool: '*', action: 'allow' }`
4. Read-only tools (no side effects) need no permission rule — they're allowed by the wildcard fallback

### Session Storage

Sessions live in `.wardayacode/` at the project root as append-only JSONL files (one JSON object per line). `Session.ts` appends; `SessionManager.ts` handles lifecycle (create, list, resume). The directory is gitignored.

### Test Setup

Vitest globals are enabled — `describe`, `it`, `expect`, `beforeEach` etc. are available without imports. Tests live in `tests/`, coverage excludes `src/ui/**` and `.tsx` files.
