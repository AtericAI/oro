# oro — Implementation Plan

This document tells Claude exactly what to build and in what order. Read ARCHITECTURE.md, AGENTS.md, WORKFLOW.md, and SPECS.md first.

---

## Build Order

Build in this order. Each phase produces runnable/testable output.

---

## Phase 1: Project Scaffold

Create the repository structure and all config files.

### 1.1 — Repository root

Create:
- `package.json` (from SPECS.md §5)
- `tsconfig.json` (base config for all TypeScript)
- `tsconfig.server.json` (extends base, targets `oro/server/`)
- `tsconfig.cli.json` (extends base, targets `oro/cli/`)
- `.gitignore` (standard Node.js + oro-specific additions from SPECS.md §6)
- `README.md` (project overview, install command, quick start)
- `LICENSE` (MIT)

### 1.2 — Prompt files

Create all files in `oro/prompts/`:
- `scan_file.md` — exact content from WORKFLOW.md §scan_file.md
- `update_wiki_index.md` — exact content from WORKFLOW.md §update_wiki_index.md
- `analyze.md` — exact content from WORKFLOW.md §analyze.md
- `orchestrate.md` — exact content from WORKFLOW.md §orchestrate.md
- `execute.md` — exact content from WORKFLOW.md §execute.md
- `push_pr.md` — exact content from WORKFLOW.md §push_pr.md

### 1.3 — Shell scripts

Create all files in `oro/scripts/`:
- `run.sh` — exact content from WORKFLOW.md §run.sh
- `scan.sh` — exact content from WORKFLOW.md §scan.sh
- `analyze.sh` — exact content from WORKFLOW.md §analyze.sh
- `orchestrate.sh` — exact content from WORKFLOW.md §orchestrate.sh
- `execute.sh` — exact content from WORKFLOW.md §execute.sh
- `update_wiki.sh` — exact content from WORKFLOW.md §update_wiki.sh
- `push_pr.sh` — exact content from WORKFLOW.md §push_pr.sh

All scripts must be `chmod +x`.

### 1.4 — OpenCode config

Create:
- `oro/opencode.json` — exact content from opencode.json
- `oro/AGENTS.md` — exact content from AGENTS.md

### 1.5 — Config template

Create `oro/config.template.json`:
```json
{
  "version": "1.0.0",
  "opencode": {
    "api_key": "$ORO_OPENCODE_KEY",
    "plan": "go"
  },
  "github": {
    "token": "$ORO_GITHUB_TOKEN",
    "base_branch": "main",
    "pr_labels": ["automated", "code-quality"],
    "pr_draft": false
  },
  "scan": {
    "extensions": [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".cs", ".rb", ".php"],
    "exclude_patterns": ["node_modules", ".git", "dist", "build", "coverage", "__pycache__", "*.min.js"],
    "max_file_size_kb": 500,
    "incremental": true
  },
  "execution": {
    "max_executors": 5,
    "max_executor_loops": 5,
    "run_tests": true,
    "test_command": "auto"
  },
  "schedule": {
    "cron": "0 0 * * *",
    "enabled": true,
    "timezone": "UTC"
  },
  "ui": {
    "port": 7070,
    "host": "localhost"
  }
}
```

---

## Phase 2: CLI

Build the Node.js CLI (`oro/cli/`).

### 2.1 — CLI entry point

`oro/cli/index.ts`:
- Commander.js program setup
- All commands registered (from SPECS.md §2)
- `#!/usr/bin/env node` shebang

### 2.2 — Command: `oro init`

`oro/cli/commands/init.ts`:

```typescript
// 1. Check if oro/ already exists — ask to overwrite if so
// 2. Create all directories:
//    oro/wiki/files/
//    oro/wiki/modules/
//    oro/logs/
//    oro/prompts/
//    oro/scripts/
//    oro/server/ (copy from ~/.oro/server/ or from package)
// 3. Copy prompt files from package templates
// 4. Copy shell scripts from package templates + chmod +x
// 5. Write oro/opencode.json
// 6. Write oro/AGENTS.md
// 7. Write oro/config.json from template + user input
// 8. Write oro/wiki/README.md (placeholder)
// 9. Write oro/wiki/index.json ({})
// 10. Add oro entries to project .gitignore
// 11. Register cron if enabled (using node-cron or crontab)
// 12. Start UI server if enabled
// 13. Print success message
```

Interactive prompts (use `@inquirer/prompts` or `readline`):
- `"Enter your OpenCode Go API key:"` → stored as `$ORO_OPENCODE_KEY` in `.env.oro` (not committed)
- `"Enter your GitHub token (press Enter to skip):"` → stored as `$ORO_GITHUB_TOKEN`
- `"Run daily at midnight? [Y/n]:"` → sets schedule.enabled
- `"Start UI server now? [Y/n]:"` → starts server if yes

### 2.3 — Command: `oro run`

`oro/cli/commands/run.ts`:

```typescript
// Check for stale lock (> 4 hours old) → remove if stale
// Write lock file: oro/logs/.lock
// Load environment from .env.oro
// Set OPENCODE_API_KEY from config
// Execute: bash oro/scripts/run.sh
// Stream stdout/stderr to terminal
// On complete: remove lock file
// On error: set state FAILED, remove lock
```

### 2.4 — Command: `oro status`

`oro/cli/commands/status.ts`:

```typescript
// Read oro/logs/.current_state
// Read today's log directory if it exists
// Print:
//   Current state: IDLE / SCANNING / etc.
//   Last run: YYYY-MM-DD HH:MM
//   Last run result: N tasks succeeded, N failed
//   Next scheduled run: (from cron config)
```

### 2.5 — Command: `oro logs`

`oro/cli/commands/logs.ts`:

```typescript
// If date provided: list files for that date
// If file specified: cat the file with basic ANSI markdown rendering
// If neither: list all available dates
```

### 2.6 — Command: `oro ui`

`oro/cli/commands/ui.ts`:

```typescript
// Check if server is running on port 7070
// If not: start it (spawn server/index.js as background process, write PID)
// Open browser: open http://localhost:7070
```

### 2.7 — Command: `oro schedule`

`oro/cli/commands/schedule.ts`:

```typescript
// Read/write schedule config in oro/config.json
// Update system crontab via `crontab -l` + `crontab -`
// Print current schedule
```

---

## Phase 3: Server

Build the Express server (`oro/server/`).

### 3.1 — Main server

`oro/server/index.ts`:
- Implement exactly as specified in SPECS.md §3
- All API routes
- SSE endpoint
- Static file serving

### 3.2 — Types

`oro/server/types.ts`:
```typescript
export interface LogDate {
  date: string
  files: string[]
  state: RunState
}

export type RunState = 
  | 'IDLE' | 'SCANNING' | 'SCANNING_DONE'
  | 'ANALYZING' | 'ANALYZING_DONE'
  | 'ORCHESTRATING' | 'ORCHESTRATING_DONE'
  | 'EXECUTING' | 'EXECUTING_DONE'
  | 'UPDATING_WIKI' | 'UPDATING_WIKI_DONE'
  | 'PUSHING_PR' | 'FAILED' | 'UNKNOWN'

export interface WikiIndex {
  generated_at: string
  total_files: number
  languages: Record<string, number>
  file_types: Record<string, number>
  quality_issue_categories: Record<string, number>
  files: WikiFile[]
}

export interface WikiFile {
  path: string
  wiki: string
  type: string
  language: string
  lines: number
  quality_issues: string[]
  summary: string
}
```

---

## Phase 4: UI

Build the React frontend (`oro/ui/`).

### 4.1 — Vite config

`oro/ui/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: '../server/static',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:7070',
    },
  },
})
```

### 4.2 — `index.html`

The HTML entry point. Loads the fonts:
- `https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap` (headings in log viewer)
- Use a system monospace stack for UI chrome (no web font — faster load)

### 4.3 — CSS Variables (`oro/ui/src/styles/vars.css`)

```css
:root {
  --bg: #0f0f0f;
  --panel: #141414;
  --panel-2: #181818;
  --border: #242424;
  --border-soft: #1e1e1e;
  --text: #e8e8e8;
  --text-muted: #888888;
  --text-dim: #555555;
  --accent: #b8f2a1;
  --accent-dim: rgba(184, 242, 161, 0.15);
  --status-running: #fbbf24;
  --status-success: #4ade80;
  --status-failed: #f87171;
  --status-idle: #555555;
  --font-mono: "Berkeley Mono", "Cascadia Code", "Fira Code", "Consolas", monospace;
  --font-serif: "DM Serif Display", Georgia, serif;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --radius: 6px;
  --sidebar-width: 240px;
  --wiki-width: 320px;
  --topbar-height: 48px;
}
```

### 4.4 — `App.tsx`

```typescript
// State:
//   selectedDate: string | null
//   selectedFile: string | null  
//   wikiOpen: boolean
//   sidebarCollapsed: boolean
//
// Layout:
//   <div class="app-shell">
//     <Topbar runState={runState} onRunNow={handleRunNow} onToggleWiki={...} />
//     <div class="app-body">
//       <Sidebar ... />
//       <LogViewer ... />
//       {wikiOpen && <WikiBrowser onClose={...} />}
//     </div>
//   </div>
//
// Keyboard shortcuts:
//   Cmd+W: toggle wiki panel
//   Cmd+B: toggle sidebar
//   Escape: close wiki panel
```

### 4.5 — `components/Sidebar.tsx`

Implement per SPECS.md §4 "Sidebar component":
- Collapsible date groups with chevron icons
- Phase-labeled file items:
  - `00-scan.md` → "Scan"
  - `01-analysis.md` → "Analysis" 
  - `02-plan.md` → "Plan"
  - `03-orchestration.md` → "Orchestration"
  - `04-execution-N.md` → "Executor N"
  - `05-wiki-update.md` → "Wiki Update"
  - `06-pr.md` → "Pull Request"
- State indicator dot next to today's date
- "Wiki" link at bottom

### 4.6 — `components/LogViewer.tsx`

- Accept `content: string` (raw markdown)
- Render using `marked` with `highlight.js` for code
- Sticky mini-header with file name and phase
- Scroll restoration on file change
- Empty state: "Select a log from the sidebar"
- Loading state: skeleton

### 4.7 — `components/RunStatus.tsx`

- Animated status pill (CSS pulse animation when running)
- State → label mapping:
  - IDLE → "idle" (grey)
  - SCANNING → "scanning…" (amber, pulsing)
  - ANALYZING → "analyzing…" (amber, pulsing)
  - ORCHESTRATING → "orchestrating…" (amber, pulsing)
  - EXECUTING → "executing…" (amber, pulsing)
  - UPDATING_WIKI → "updating wiki…" (amber, pulsing)
  - PUSHING_PR → "pushing PR…" (amber, pulsing)
  - FAILED → "failed" (red)
  - SCANNING_DONE / *_DONE → "idle" (green briefly, then grey)
- Clicking opens a popover showing last 20 lines of latest.log
- "Run Now" button triggers `POST /api/run`

### 4.8 — `components/WikiBrowser.tsx`

- Right panel, 320px
- Header: "Wiki" + file count + close button
- Quality issues table (from index.json quality_issue_categories)
- Searchable file list
- Clicking file: fetches and shows that wiki entry in LogViewer

### 4.9 — Hooks

`oro/ui/src/hooks/useLogs.ts`:
```typescript
// Fetches /api/logs
// Returns: { dates: LogDate[], isLoading, error, refetch }
// Auto-refetches when SSE state changes from running → idle
```

`oro/ui/src/hooks/useSSE.ts`:
```typescript
// Subscribes to /api/events using EventSource
// Returns: { state: RunState, isRunning: boolean, lastEvent: object | null }
// Handles reconnection on disconnect
```

`oro/ui/src/hooks/useLogContent.ts`:
```typescript
// Fetches /api/logs/:date/:file when (date, file) changes
// Returns: { content, html, isLoading, error }
```

---

## Phase 5: Installer

Build `install.sh` at the repository root.

Implement as specified in SPECS.md §1.

Key behaviors:
- Idempotent: running twice doesn't break anything
- Fast: skip steps that are already done
- Informative: show progress with checkmarks
- Non-destructive: never overwrites existing `oro/config.json` (prompts instead)

---

## Phase 6: README

The `README.md` at repository root must include:

1. Project description and philosophy (2 paragraphs)
2. Architecture diagram (ASCII art showing the 3-model workflow)
3. Install command (the one-liner)
4. Quick start (5 commands to get going)
5. Configuration reference
6. How the models are used (with the cost table)
7. FAQ:
   - "Why not just use Claude/GPT directly?" → Cost. This runs for <$0.50/day.
   - "What kinds of problems does it fix?" → Typed errors, missing patterns, dead code, inconsistent structure, untested logic
   - "Will it break my code?" → git is the safety net. Every change is committed atomically. `oro reset --hard` undoes everything.
   - "Can I run it manually?" → Yes: `oro run`
8. Contributing guide (brief)
9. License

---

## Testing

After building, verify:

1. `npm run build` succeeds
2. `node dist/cli/index.js --version` prints version
3. `node dist/cli/index.js --help` shows all commands
4. `node dist/server/index.js` starts on port 7070 and returns `{"dates":[]}` from `/api/logs`
5. Shell scripts have correct syntax: `bash -n oro/scripts/run.sh` (all scripts)
6. Prompt files exist and are non-empty
7. `opencode.json` is valid JSON

---

## What NOT to Build

- Do not build a custom OpenCode wrapper — use the `opencode run` CLI directly from shell scripts
- Do not build agent-to-agent communication — files are the message bus
- Do not build a database — filesystem is the store
- Do not add authentication to the UI — it's localhost-only
- Do not add retry logic to the CLI commands beyond what's in the scripts — keep it simple
- Do not add telemetry or analytics
