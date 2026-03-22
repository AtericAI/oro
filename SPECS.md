# oro — Technical Specifications

## 1. Installation

### install.sh

The single-command installer. Hosted at the repo root. Usage:

```bash
curl -fsSL https://raw.githubusercontent.com/orohq/oro/main/install.sh | bash
```

**Implementation requirements:**

```bash
#!/usr/bin/env bash
set -e

# ── Constants ─────────────────────────────────────────────────────────────────
ORO_REPO="https://github.com/orohq/oro"
ORO_INSTALL_DIR="$HOME/.oro"
ORO_VERSION="${ORO_VERSION:-latest}"
OPENCODE_MIN_VERSION="1.0.0"
NODE_MIN_VERSION="18"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

print_logo() {
  echo -e "${BOLD}"
  echo "  ┌─────────────────────────────────┐"
  echo "  │  ○  oro — code quality agent    │"
  echo "  └─────────────────────────────────┘"
  echo -e "${RESET}"
}

# ── Preflight checks ──────────────────────────────────────────────────────────
check_node() {
  # Check Node.js >= 18
}

check_git() {
  # Check Git >= 2.30
}

check_or_install_opencode() {
  # Check if opencode is installed
  # If not: curl -fsSL https://opencode.ai/install | bash
  # Verify opencode-go plan models are available
}

check_gh_cli() {
  # Check for GitHub CLI (gh)
  # If missing: print instructions, do not fail hard (PR push is optional)
}

# ── Clone oro ─────────────────────────────────────────────────────────────────
clone_or_update_oro() {
  if [[ -d "$ORO_INSTALL_DIR" ]]; then
    echo "Updating oro..."
    cd "$ORO_INSTALL_DIR" && git pull
  else
    echo "Installing oro..."
    git clone "$ORO_REPO" "$ORO_INSTALL_DIR"
  fi
  cd "$ORO_INSTALL_DIR"
  npm install --silent
  npm run build --silent
}

# ── PATH setup ────────────────────────────────────────────────────────────────
setup_path() {
  # Write to .bashrc and .zshrc:
  # export PATH="$HOME/.oro/bin:$PATH"
  # Create ~/.oro/bin/oro symlink to ~/.oro/dist/cli/index.js
}

# ── Project init ──────────────────────────────────────────────────────────────
init_project() {
  # Interactive prompts:
  # 1. "Enter your OpenCode Go API key:"
  # 2. "Enter your GitHub token (or press Enter to skip PR push):"
  # 3. "Run oro daily at midnight? [Y/n]:"
  # 4. "Start UI server on port 7070? [Y/n]:"
  
  # Then run: oro init
}

# ── Main ──────────────────────────────────────────────────────────────────────
print_logo
check_node
check_git
check_or_install_opencode
check_gh_cli
clone_or_update_oro
setup_path
init_project

echo -e "${GREEN}✓ oro installed successfully${RESET}"
echo ""
echo "Quick start:"
echo "  oro run          # Run now"
echo "  oro status       # Check last run"
echo "  oro ui           # Open UI at http://localhost:7070"
echo "  oro --help       # All commands"
```

---

### `oro init` command

When run in a project directory, creates the `oro/` folder structure:

```bash
oro init
├── Creates: oro/wiki/files/ (empty)
├── Creates: oro/wiki/README.md (placeholder)
├── Creates: oro/wiki/index.json (empty index)
├── Creates: oro/logs/ (empty)
├── Creates: oro/prompts/ (writes all prompt files from WORKFLOW.md)
├── Creates: oro/scripts/ (writes all shell scripts from WORKFLOW.md)
├── Creates: oro/opencode.json (from opencode.json spec)
├── Creates: oro/AGENTS.md (from AGENTS.md spec)
├── Creates: oro/config.json (from user input during install)
├── Creates: ore/server/ (copies server from ~/.oro/server/)
├── Registers cron job if enabled
├── Starts UI server if enabled
└── Runs initial `oro scan` to bootstrap the wiki
```

---

## 2. CLI Interface

The `oro` CLI is a Node.js binary (`oro/cli/index.ts`) compiled to a standalone script.

### Commands

```
oro run              Run a full oro cycle (scan → analyze → orchestrate → execute → wiki → pr)
oro scan             Run only the wiki scan phase
oro analyze          Run only the analysis phase (requires wiki to exist)
oro status           Show status of last/current run
oro logs [date]      Show logs for a date (default: today)
oro ui               Open the UI in browser (starts server if not running)
oro schedule         Manage the cron schedule
oro config           View/edit oro configuration
oro init             Initialize oro in current directory
oro upgrade          Upgrade oro to latest version
oro --help           Show help
oro --version        Show version
```

### CLI Implementation (`oro/cli/index.ts`)

```typescript
#!/usr/bin/env node
import { program } from 'commander'
import { runCmd } from './commands/run'
import { scanCmd } from './commands/scan'
import { statusCmd } from './commands/status'
import { logsCmd } from './commands/logs'
import { uiCmd } from './commands/ui'
import { scheduleCmd } from './commands/schedule'
import { configCmd } from './commands/config'
import { initCmd } from './commands/init'

const VERSION = require('../../package.json').version

program
  .name('oro')
  .description('Code quality engineer AI agent')
  .version(VERSION)

program.command('run')
  .description('Run a full oro quality cycle')
  .option('--force', 'Force re-scan even if wiki is fresh')
  .option('--no-pr', 'Skip PR push')
  .option('--phase <phase>', 'Start from specific phase')
  .action(runCmd)

program.command('scan')
  .description('Run only the wiki scan phase')
  .option('--force', 'Force re-scan all files')
  .action(scanCmd)

program.command('status')
  .description('Show status of current/last run')
  .action(statusCmd)

program.command('logs [date]')
  .description('View run logs')
  .action(logsCmd)

program.command('ui')
  .description('Open the UI')
  .action(uiCmd)

program.command('schedule')
  .description('Manage the run schedule')
  .option('--cron <expression>', 'Set cron expression')
  .option('--disable', 'Disable scheduling')
  .option('--enable', 'Enable scheduling')
  .action(scheduleCmd)

program.command('init')
  .description('Initialize oro in current directory')
  .action(initCmd)

program.parse()
```

---

## 3. UI Server

### Server (`oro/server/index.ts`)

```typescript
import express from 'express'
import { createServer } from 'http'
import path from 'path'
import fs from 'fs'
import { marked } from 'marked'

const app = express()
const PORT = process.env.ORO_PORT || 7070

// SSE connections for live run tailing
const sseClients: Set<express.Response> = new Set()

// ── API Routes ────────────────────────────────────────────────────────────────

// GET /api/logs — list all dates and their log files
app.get('/api/logs', (req, res) => {
  const logsDir = path.join(process.cwd(), 'oro', 'logs')
  
  if (!fs.existsSync(logsDir)) {
    return res.json({ dates: [] })
  }
  
  const dates = fs.readdirSync(logsDir)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse()
    .map(date => {
      const dateDir = path.join(logsDir, date)
      const files = fs.readdirSync(dateDir)
        .filter(f => f.endsWith('.md') && !f.startsWith('.'))
        .sort()
      const stateFile = path.join(dateDir, '.state')
      const state = fs.existsSync(stateFile) 
        ? fs.readFileSync(stateFile, 'utf-8').trim()
        : 'UNKNOWN'
      return { date, files, state }
    })
  
  res.json({ dates })
})

// GET /api/logs/:date/:file — get log file content (raw markdown)
app.get('/api/logs/:date/:file', (req, res) => {
  const filePath = path.join(
    process.cwd(), 'oro', 'logs',
    req.params.date,
    req.params.file
  )
  
  if (!fs.existsSync(filePath) || !filePath.endsWith('.md')) {
    return res.status(404).json({ error: 'Not found' })
  }
  
  const content = fs.readFileSync(filePath, 'utf-8')
  res.json({ content, html: marked(content) })
})

// GET /api/status — current run state
app.get('/api/status', (req, res) => {
  const stateFile = path.join(process.cwd(), 'oro', 'logs', '.current_state')
  const state = fs.existsSync(stateFile)
    ? fs.readFileSync(stateFile, 'utf-8').trim()
    : 'IDLE'
  res.json({ state, timestamp: new Date().toISOString() })
})

// GET /api/wiki — wiki file listing
app.get('/api/wiki', (req, res) => {
  const indexPath = path.join(process.cwd(), 'oro', 'wiki', 'index.json')
  if (!fs.existsSync(indexPath)) {
    return res.json({ files: [], generated_at: null })
  }
  res.json(JSON.parse(fs.readFileSync(indexPath, 'utf-8')))
})

// GET /api/wiki/:filename — get wiki file content
app.get('/api/wiki/:filename', (req, res) => {
  const filePath = path.join(
    process.cwd(), 'oro', 'wiki', 'files',
    req.params.filename
  )
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' })
  }
  const content = fs.readFileSync(filePath, 'utf-8')
  res.json({ content, html: marked(content) })
})

// GET /api/events — SSE for live run tailing
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  
  sseClients.add(res)
  
  // Watch the latest.log file for changes
  const logFile = path.join(process.cwd(), 'oro', 'logs', 'latest.log')
  const watcher = fs.watch(path.dirname(logFile), (event, filename) => {
    if (filename === 'latest.log' || filename === '.current_state') {
      const state = path.join(process.cwd(), 'oro', 'logs', '.current_state')
      const currentState = fs.existsSync(state) 
        ? fs.readFileSync(state, 'utf-8').trim() 
        : 'IDLE'
      res.write(`data: ${JSON.stringify({ type: 'state', state: currentState })}\n\n`)
    }
  })
  
  req.on('close', () => {
    sseClients.delete(res)
    watcher.close()
  })
  
  // Heartbeat
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`)
  }, 30000)
  
  req.on('close', () => clearInterval(heartbeat))
})

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'static')))
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`oro UI running at http://localhost:${PORT}`)
})
```

---

## 4. UI Design Specification

### Visual Identity

- **Theme:** Dark, editorial, monospace-adjacent
- **Primary color:** `#b8f2a1` (muted lime green) — used for active states and the oro logo mark
- **Background:** `#0f0f0f` (near-black)
- **Panel:** `#141414`
- **Border:** `#242424`
- **Text primary:** `#e8e8e8`
- **Text secondary:** `#888888`
- **Font:** `"Berkeley Mono", "Cascadia Code", "Fira Code", monospace` for UI chrome; `"DM Serif Display", Georgia, serif` for log headers
- **Status colors:** Green `#4ade80` (SUCCESS/IDLE), Amber `#fbbf24` (running), Red `#f87171` (FAILED)

### Layout (3-column, Notion-inspired)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ○ oro                                     [status pill] [run button] │  ← Topbar (48px)
├──────────────┬────────────────────────────┬────────────────────────┤
│              │                            │                          │
│  SIDEBAR     │  LOG VIEWER                │  WIKI PANEL (optional)  │
│  (240px)     │  (flex-grow)               │  (320px, toggleable)    │
│              │                            │                          │
│  ▼ 2026-03   │  # Bottleneck Analysis     │  Files                  │
│    ▼ 03-21   │                            │  ─────────              │
│      scan    │  ## Selected Problem       │  src/auth/user.ts       │
│    ▶ analyze │  Missing error types in    │  src/api/routes.ts      │
│      plan    │  authentication module     │  src/utils/logger.ts    │
│      exec-1  │                            │                          │
│      pr      │  ## Why This Problem       │  ──────────────────     │
│              │  The wiki shows 12 files   │  Quality Issues         │
│  ▶ 2026-03   │  in the auth module with   │  ─────────────          │
│    ▼ 03-20   │  raw Error throws...       │  No error types: 12     │
│      ...     │                            │  Missing tests: 8       │
│              │                            │  Magic numbers: 5       │
│  [Wiki]      │                            │                          │
└──────────────┴────────────────────────────┴────────────────────────┘
```

### Component Specifications

**`Sidebar` component:**
- Fixed 240px width
- Groups log files by date in collapsible sections
- Date headers formatted as "Mar 21" with chevron
- Log file names: phase-named labels ("Scan", "Analysis", "Plan", "Exec 1..N", "PR")
- Active file highlighted with left border `#b8f2a1`
- Bottom section: "Wiki" link that opens Wiki panel
- Run status dot (pulsing green = running, grey = idle, red = failed)

**`LogViewer` component:**
- Renders markdown with syntax highlighting (via `highlight.js` or `prism`)
- Scrollable, preserves scroll position when switching files
- Floating "copy" button top-right
- Shows file phase label and timestamp in a sticky mini-header
- Code blocks: `#1a1a1a` background, monospace font
- Tables: full-width, alternating rows `#141414` / `#161616`

**`RunStatus` component (topbar):**
- Pill showing current state: `● IDLE`, `⟳ SCANNING`, `⟳ ANALYZING`, etc.
- Pulses when running
- Clicking it shows a popover with the last 20 lines of `latest.log`
- "Run Now" button: triggers `POST /api/run` (starts `oro run` in background)

**`WikiBrowser` component (right panel):**
- Toggleable with a keyboard shortcut (Cmd+W or button)
- Shows count summary: "142 files, 3 languages"
- Quality issues summary table
- File list with search filter
- Clicking a file shows its wiki entry in the LogViewer

### React App Structure (`oro/ui/src/`)

```typescript
// App.tsx — root layout
// State: selectedDate, selectedFile, sidebarCollapsed, wikiOpen, runState

// Sidebar.tsx
// Props: dates, selectedDate, selectedFile, onSelect
// Uses: useLogs() hook

// LogViewer.tsx
// Props: content (markdown string), phase, timestamp
// Renders markdown with highlight.js

// RunStatus.tsx
// Uses: useSSE() hook for live state
// Renders: state pill + popover with latest.log tail

// WikiBrowser.tsx
// Props: isOpen, onClose
// Uses: /api/wiki endpoint

// hooks/useLogs.ts
// Fetches /api/logs, returns { dates, isLoading, error }

// hooks/useSSE.ts
// Subscribes to /api/events
// Returns: { state, isRunning, lastEvent }
```

---

## 5. Package Structure

```json
{
  "name": "oro",
  "version": "0.1.0",
  "description": "Open-source code quality engineer AI agent",
  "bin": {
    "oro": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "npm run build:server && npm run build:ui && npm run build:cli",
    "build:server": "tsc -p tsconfig.server.json",
    "build:ui": "vite build --config ui/vite.config.ts",
    "build:cli": "tsc -p tsconfig.cli.json && chmod +x dist/cli/index.js",
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:ui\"",
    "dev:server": "tsx watch oro/server/index.ts",
    "dev:ui": "vite --config ui/vite.config.ts"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "express": "^4.18.0",
    "marked": "^12.0.0",
    "node-cron": "^3.0.0",
    "highlight.js": "^11.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "concurrently": "^8.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "vite": "^5.0.0"
  }
}
```

---

## 6. .gitignore additions

oro adds to the project's `.gitignore`:

```gitignore
# oro generated files
oro/logs/
oro/wiki/files/
oro/wiki/index.json

# Keep these tracked:
# oro/wiki/README.md  ← intentionally NOT ignored (summary visible in repo)
# oro/prompts/
# oro/scripts/
# oro/opencode.json
# oro/AGENTS.md
# oro/config.json     ← tracked but with secrets in env vars
```

---

## 7. Environment Variables

```bash
ORO_OPENCODE_KEY      # OpenCode Go API key
ORO_GITHUB_TOKEN      # GitHub personal access token for PR creation
ORO_PORT              # UI server port (default: 7070)
ORO_NO_COLOR          # Disable colored output
ORO_LOG_LEVEL         # debug | info | warn | error (default: info)
```

config.json references these as `"$ORO_OPENCODE_KEY"` and the CLI resolves them at runtime.

---

## 8. Error Handling & Recovery

### Graceful degradation

1. **Wiki scan partial failure:** If N files fail to scan, the run continues. The analysis uses whatever wiki entries exist.
2. **Executor failure:** If an executor fails, the others continue. A failed executor writes its failure to the log. The PR is still pushed with whatever succeeded.
3. **Analysis failure:** If GLM-5 produces a malformed plan, the orchestrator phase is skipped. The log records the failure. Next run attempts again.
4. **PR push failure:** Non-fatal. Logs the failure. Changes remain committed locally.

### Stale lock detection

oro writes a `oro/logs/.lock` file at start. If the lock is older than 4 hours, it's considered stale and removed. This prevents stuck runs from blocking future cron jobs.

### Manual override commands

```bash
oro reset              # Remove lock, reset state to IDLE
oro reset --hard       # Reset + git reset --hard HEAD (undo all executor commits)
```
