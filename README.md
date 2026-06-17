# wardayacode

AI-powered coding agent for the terminal. Supports Claude, GPT-4, and Gemini out of the box.

```
$ wardayacode
❯ Fix the authentication bug in src/auth.ts

● read_file(src/auth.ts)
✓ Found issue: token expiry check uses wrong comparison
● edit_file(src/auth.ts)
✓ Fixed: changed > to < in token expiry check on line 42

The bug was on line 42 — the expiry comparison was inverted.
I've corrected it and the token validation should now work as expected.
```

## Install

```bash
npm install -g wardayacode
```

Requires Node.js 20+.

## Quick Start

**1. Set your API key**

```bash
# Anthropic (Claude)
export ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
export OPENAI_API_KEY=sk-...

# Google (Gemini)
export GOOGLE_GENERATIVE_AI_API_KEY=AIza...
```

Or save it permanently:

```bash
wardayacode auth login anthropic
wardayacode auth login openai
wardayacode auth login google
```

**2. Run it**

```bash
wardayacode        # interactive TUI
wdc                # short alias
```

**3. Start coding**

Type any task in natural language. The agent reads your files, makes edits, runs commands, and explains what it did.

## Usage

```bash
# Interactive TUI (default)
wardayacode

# Send an initial prompt directly
wardayacode "add input validation to src/api/users.ts"

# Choose a model
wardayacode --model gpt-4o --provider openai
wardayacode --model gemini-2.0-flash --provider google
wardayacode --model claude-sonnet-4-20250514 --provider anthropic

# Set permission mode
wardayacode --mode auto        # approve everything automatically
wardayacode --mode plan        # read-only, no file writes

# Resume a previous session
wardayacode sessions list
wardayacode --resume <sessionId>

# Debug mode (logs tool calls to ~/.wardayacode/logs/)
wardayacode --debug

# Non-interactive (pipe-friendly)
wardayacode --no-tui "summarize the architecture"
```

## Slash Commands

Type `/` in the TUI to open the command palette, or use these directly:

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/clear` | Clear the conversation |
| `/mode <mode>` | Switch permission mode |
| `/model` | Show current model |
| `/session` | Show session info |
| `/tokens` | Show token usage |
| `/undo` | Revert the last file change |
| `/diff` | Show uncommitted git changes |
| `/checkpoint` | Create a git stash checkpoint |
| `/rollback` | Restore last checkpoint |
| `/login <provider> <key>` | Save an API key |
| `/logout <provider>` | Remove a saved API key |
| `/auth` | Show provider auth status |
| `/exit` | Exit wardayacode |

## Permission Modes

wardayacode asks before making changes. You control how much it can do automatically:

| Mode | File reads | File writes | Bash / Git | Use when |
|------|-----------|------------|-----------|----------|
| `default` | ✅ auto | ❓ prompt | ❓ prompt | Daily use |
| `plan` | ✅ auto | ❌ blocked | ❌ blocked | Review-only |
| `acceptEdits` | ✅ auto | ✅ auto | ❓ prompt | Trusted edits |
| `auto` | ✅ auto | ✅ auto | ✅ auto | Scripting / CI |
| `internal` | ✅ auto | ✅ auto | ✅ auto | Fully trusted |

Switch mode mid-session with `/mode <name>` or choose "Always allow" when prompted.

## Tools

The agent has access to these tools:

| Tool | What it does |
|------|-------------|
| `read_file` | Read a file with optional line range |
| `write_file` | Create or overwrite a file |
| `edit_file` | Surgical string-replacement edits |
| `bash` | Run shell commands |
| `git` | Run git commands (status, log, diff, add, commit, push, …) |
| `glob` | Find files by pattern (`**/*.ts`) |
| `grep` | Search file contents with regex |
| `list_files` | List a directory |

Dangerous operations (force push, `rm -rf`, `dd`, etc.) are permanently blocked regardless of permission mode.

## Configuration

Create `.wardayacode.json` in your project root for project-level config, or `~/.config/wardayacode/config.json` for global defaults:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "permissionMode": "default",
  "maxTokens": 8192,
  "temperature": 0,
  "theme": "dark"
}
```

API keys can also live in config (though environment variables are preferred):

```json
{
  "apiKeys": {
    "anthropic": "sk-ant-...",
    "openai": "sk-...",
    "google": "AIza..."
  }
}
```

**Config priority** (highest wins): CLI flags → project `.wardayacode.json` → user config → defaults.

## Sessions

Conversations are saved automatically as JSONL files in `.wardayacode/` in your project directory.

```bash
wardayacode sessions list          # list sessions
wardayacode sessions delete <id>   # delete a session
wardayacode --resume <id>          # resume a session
```

Sessions let you continue where you left off across terminal restarts.

## Debug & Logs

```bash
wardayacode --debug "fix the bug"
```

With `--debug`, all tool calls, results, and errors are written to:

```
~/.wardayacode/logs/YYYY-MM-DD-<sessionId>.log
```

Each line is structured JSON (`ts`, `level`, `msg`, `meta`). Tail it in another terminal:

```bash
tail -f ~/.wardayacode/logs/$(ls -t ~/.wardayacode/logs | head -1)
```

You can also set `LOG_LEVEL=debug` as an environment variable.

## Troubleshooting

**`command not found: wardayacode`**
```bash
npm install -g wardayacode
# if still not found, check npm global bin is in your PATH:
npm config get prefix   # add <prefix>/bin to PATH
```

**API key errors**
```bash
wardayacode auth list    # check which providers are configured
wardayacode auth login anthropic   # re-enter the key
```

**Agent makes too many changes**
Use `/mode plan` to switch to read-only mode mid-session, or start with `--mode plan`.

**Long conversations slow down or lose context**
wardayacode automatically compacts context when it nears the token limit. You'll see a system message when this happens. Use `/clear` to start fresh if needed.

**Something went wrong and files were changed**
```bash
/undo          # revert the last file edit
/rollback      # restore to last git checkpoint
/diff          # see what changed
```

## Development

```bash
git clone https://github.com/fawwazmw/wardayacode
cd wardayacode
npm install

npm run dev            # run from source (no build)
npm run build          # bundle to dist/
npm run type-check     # TypeScript strict check
npm run lint           # ESLint
npm test               # Vitest watch mode
npm run test:run       # single CI run
```

## License

MIT — [Fawwaz Mufid W](https://github.com/fawwazmw)
