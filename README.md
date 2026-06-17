# wardayacode

AI-powered coding agent for the terminal. Multi-provider, full-featured.

```
$ wardayacode
❯ Fix the authentication bug in src/auth.ts

● Reading src/auth.ts...
● Found issue: token expiry check uses wrong comparison
● Editing src/auth.ts...
✓ Fixed: changed `>` to `<` in token expiry check on line 42
```

## Features

- **Multi-Provider** — Claude, GPT-4, Gemini, or any OpenAI-compatible API
- **Full Tool Suite** — File read/write/edit, bash execution, glob, grep, git
- **Interactive TUI** — Rich terminal interface with streaming responses
- **Permission System** — 5 graduated trust levels (default → auto → internal)
- **Session Persistence** — Resume conversations, review history
- **Extensible** — Hooks, skills, and plugin system

## Quick Start

```bash
# Install
npm install -g wardayacode

# Or run from source
git clone https://github.com/wardayadev/wardayacode
cd wardayacode
npm install
npm run dev

# Set your API key
export ANTHROPIC_API_KEY=sk-...
# or
export OPENAI_API_KEY=sk-...
# or
export GOOGLE_GENERATIVE_AI_API_KEY=...
```

## Usage

```bash
# Interactive mode (default)
wardayacode

# Short alias
wdc

# With specific model
wardayacode --model claude-sonnet-4-20250514 --provider anthropic

# With permission mode
wardayacode --mode auto  # Auto-approve safe operations

# Plain text mode (no TUI)
wardayacode --no-tui

# Authenticate providers (saved in ~/.config/wardayacode/config.json)
wardayacode auth login openai
wardayacode auth login anthropic
wardayacode auth login google
wardayacode auth list
wardayacode auth logout openai
```

## Configuration

Create `.wardayacode.json` in your project root or `~/.config/wardayacode/config.json`:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "apiKeys": {
    "anthropic": "sk-ant-...",
    "openai": "sk-...",
    "google": "AIza..."
  },
  "maxTokens": 8192,
  "temperature": 0,
  "permissionMode": "default",
  "theme": "dark"
}
```

You can also use environment variables:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

## Architecture

```
src/
├── cli.ts              # Entry point (Commander.js)
├── types.ts            # Core type definitions
├── agent/              # Agent loop (ReAct pattern)
│   └── Agent.ts        # Stream LLM → parse tool calls → execute → loop
├── providers/          # LLM provider abstraction (Vercel AI SDK)
│   ├── anthropic.ts    # Claude
│   ├── openai.ts       # GPT
│   └── google.ts       # Gemini
├── tools/              # Tool implementations
│   ├── ReadFileTool.ts
│   ├── EditFileTool.ts
│   ├── BashTool.ts
│   ├── GlobTool.ts
│   └── GrepTool.ts
├── permissions/        # Permission system (deny-first)
├── session/            # Append-only JSONL transcripts
├── context/            # Context management & compaction
├── config/             # Configuration (cosmiconfig)
├── ui/                 # Terminal UI (React + Ink)
│   ├── App.tsx
│   ├── ChatView.tsx
│   ├── InputBar.tsx
│   └── StatusBar.tsx
└── extensibility/      # Hooks & skills
```

## Permission Modes

| Mode | Description |
|------|-------------|
| `default` | Read-only tools allowed. Write/bash require approval. |
| `plan` | Read + plan tools. No execution. |
| `acceptEdits` | Read + write allowed. Bash requires approval. |
| `auto` | Auto-approve safe operations. Dangerous ops still prompt. |
| `internal` | All tools allowed (trusted/CI mode). |

## Tools

| Tool | Description | Permission |
|------|-------------|-----------|
| `read_file` | Read file contents with line numbers | No |
| `write_file` | Create/overwrite files | Yes |
| `edit_file` | String replacement editing | Yes |
| `bash` | Execute shell commands | Yes |
| `glob` | Find files by pattern | No |
| `grep` | Search file contents | No |
| `list_files` | List directory contents | No |

## Development

```bash
# Development mode (auto-reload)
npm run dev

# Type check
npm run type-check

# Run tests
npm test

# Build
npm run build
```

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript (strict mode)
- **LLM SDK**: Vercel AI SDK (multi-provider)
- **TUI**: React + Ink
- **CLI**: Commander.js
- **Config**: Cosmiconfig
- **Persistence**: SQLite (better-sqlite3)

## License

MIT - Wardaya Dev
