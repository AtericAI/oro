# oro — Architecture Specification

> Open-source Code Quality Engineer AI Agent  
> Build target: production-grade, single-command installable, cost-optimized via OpenCode Go plan

---

## 1. System Overview

**oro** is an autonomous code quality agent that inspects a codebase on a schedule, identifies the single highest-impact maintainability problem, plans a surgical fix, dispatches a swarm of cheap AI subagents to execute it, and pushes a pull request — completely unattended.

It is designed around one constraint: **maximum quality-per-dollar**, using OpenCode's Go plan which gives access to three open models at fixed cost. Every architectural decision exists to extract the most work from the cheapest tokens.

---

## 2. Model Roles & Cost Strategy

| Model | Role | Why |
|-------|------|-----|
| `opencode-go/glm-5` | **Analyst** — reads the wiki, finds the bottleneck, writes the fix plan | Highest reasoning quality. Used once per run. Low output volume (one plan file) but high leverage on the entire run's outcome |
| `opencode-go/kimi-k2.5` | **Orchestrator** — decomposes the plan into parallel subagent tasks | Reliable instruction-following at middle cost. Acts as a prompt engineer: it reads a strategic plan and translates it into precise, bounded, step-by-step instructions for each executor |
| `opencode-go/minimax-m2.7` | **Executor** — file scanner, code writer, wiki updater | Cheapest model. High volume. Works well when instructions are concrete, atomic, and unambiguous. Never asked to reason; only to execute what it is told exactly |

### Token Budget Awareness

OpenCode Go limits:
- Per 5-hour window: ~$12
- Weekly: ~$30
- Monthly: ~$60

MiniMax M2.7 costs ~$0.0001/request at average usage. A full run scanning 200 files + 5 executors + 1 analyst + 1 orchestrator fits comfortably under $0.50. The cached context feature of OpenCode is critical — wiki files loaded once are served from cache for the entire analysis phase.

---

## 3. Repository Structure

After installation, oro creates the following structure inside the target project:

```
oro/
├── wiki/
│   ├── README.md              # Navigation guide, last-updated timestamp
│   ├── files/                 # One .md per source file
│   │   └── src_utils_auth_ts.md
│   ├── modules/               # One .md per directory/module
│   │   └── src_utils.md
│   └── index.json             # Machine-readable index for fast lookups
├── logs/
│   └── YYYY-MM-DD/
│       ├── 00-scan.md         # Wiki scan output
│       ├── 01-analysis.md     # GLM-5 bottleneck analysis
│       ├── 02-plan.md         # Fix plan document
│       ├── 03-orchestration.md # Kimi K2.5 task decomposition
│       ├── 04-execution-N.md  # One per executor (N = 1..5)
│       ├── 05-wiki-update.md  # Post-fix wiki rescan log
│       └── 06-pr.md           # PR push result
├── prompts/
│   ├── scan_file.md           # MiniMax: how to document a single file
│   ├── update_wiki_index.md   # MiniMax: rebuild wiki/README.md + index.json
│   ├── analyze.md             # GLM-5: find bottleneck + write plan
│   ├── orchestrate.md         # Kimi: decompose plan into executor tasks
│   ├── execute.md             # MiniMax: execute a single bounded task
│   └── update_wiki_post.md    # MiniMax: update wiki for changed files
├── scripts/
│   ├── run.sh                 # Main entry point for a full run
│   ├── scan.sh                # Phase 1: wiki scan loop
│   ├── analyze.sh             # Phase 2: GLM-5 analysis
│   ├── orchestrate.sh         # Phase 3: Kimi orchestration
│   ├── execute.sh             # Phase 4: executor loop launcher
│   ├── update_wiki.sh         # Phase 5: post-fix wiki update
│   └── push_pr.sh             # Phase 6: git PR push
├── server/
│   ├── index.ts               # Express server for UI (port 7070)
│   ├── routes/
│   │   ├── logs.ts            # GET /api/logs — list available log dates/files
│   │   └── content.ts         # GET /api/content/:date/:file — serve .md content
│   └── static/                # Built React UI
├── ui/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx    # Date-grouped log tree
│   │   │   ├── LogViewer.tsx  # Markdown renderer
│   │   │   ├── RunStatus.tsx  # Live run status indicator
│   │   │   └── WikiBrowser.tsx # Browse current wiki
│   │   └── hooks/
│   │       ├── useLogs.ts
│   │       └── useSSE.ts      # Server-sent events for live run tailing
│   ├── index.html
│   ├── vite.config.ts
│   └── tsconfig.json
├── opencode.json              # OpenCode agent configuration
├── AGENTS.md                  # OpenCode rules for this project
└── config.json                # oro runtime configuration
```

---

## 4. Phase Architecture

### Phase 0: Initialization (first run only)

Executed once. Creates the `oro/` directory tree, writes all prompts, initializes `wiki/README.md`, and creates `config.json`.

```
oro init
└── create directory structure
└── write prompts from templates
└── initialize wiki/README.md
└── create config.json
└── set up cron job
└── start UI server (daemonized)
```

### Phase 1: Wiki Scan (MiniMax M2.7 loop)

The Ralph loop. One file per iteration. Context cleared between every call by using `opencode run` (stateless).

```
scan.sh
└── enumerate source files (git ls-files filtered by extension)
└── for each file:
    └── check if wiki entry is fresh (< 24h old unless --force)
    └── opencode run --model minimax-m2.7 [scan_file prompt] --file $FILE
    └── write output to oro/wiki/files/$WIKI_NAME.md
    └── append to oro/logs/$DATE/00-scan.md
└── opencode run --model minimax-m2.7 [update_wiki_index prompt]
    └── reads all wiki/files/*.md
    └── writes wiki/README.md + wiki/index.json
```

**Key design decisions:**
- Files that haven't changed (git status clean) and have a fresh wiki entry are skipped — cost optimization
- Each `opencode run` call is completely isolated — no state bleed between files
- MiniMax M2.7 is told the output path and exact schema upfront — it never reasons about what to write, only fills in the schema

### Phase 2: Analysis (GLM-5)

Single call. GLM-5 reads the entire wiki via cached context.

```
analyze.sh
└── opencode run --model glm-5 [analyze prompt]
    └── reads oro/wiki/README.md (navigation)
    └── reads oro/wiki/index.json (full file index)
    └── reads targeted wiki/files/*.md (as needed)
    └── writes ONE bottleneck analysis to oro/logs/$DATE/01-analysis.md
    └── writes detailed fix plan to oro/logs/$DATE/02-plan.md
```

GLM-5 outputs a **structured plan** in a defined schema (see WORKFLOW.md). The plan includes:
- Problem statement (1 paragraph)
- Root cause (technical precision)
- Fix strategy (approach without implementation details)
- 1–5 executor tasks (each bounded to specific files)
- Success criteria (testable assertions)

### Phase 3: Orchestration (Kimi K2.5)

Kimi reads the plan and acts as a **prompt engineer** — it writes the exact instructions each MiniMax executor will receive. This is the critical leverage point: Kimi translates GLM-5's strategic thinking into concrete, mechanical instructions that MiniMax M2.7 can follow without ambiguity.

```
orchestrate.sh
└── opencode run --model kimi-k2.5 [orchestrate prompt]
    └── reads oro/logs/$DATE/02-plan.md
    └── writes oro/logs/$DATE/03-orchestration.md
        ├── executor_1_task.md  (precise step-by-step instructions)
        ├── executor_2_task.md
        └── ... (1-5 tasks)
```

Each executor task file is a complete, self-contained instruction set. MiniMax M2.7 reads it and executes mechanically.

### Phase 4: Execution (MiniMax M2.7 subagent loops)

Each executor runs independently. The Ralph loop applies here too — each loop iteration does one atomic change, runs tests, commits.

```
execute.sh
└── for each executor_N_task.md:
    └── launch opencode run --model minimax-m2.7 [execute prompt + task file]
        └── reads executor_N_task.md
        └── executes exactly as instructed (file edits)
        └── runs tests
        └── if tests pass: git commit
        └── if tests fail: reverts, documents failure in log
        └── writes oro/logs/$DATE/04-execution-N.md
    └── (all N executors run in parallel via background processes)
└── wait for all executors
```

**Executor loop guard:** Each executor gets a max of 5 loop iterations before it is force-stopped and its partial work is committed with a `[wip]` flag. This prevents runaway cost.

### Phase 5: Wiki Update (MiniMax M2.7)

Re-scans only files changed by the executors.

```
update_wiki.sh
└── git diff --name-only HEAD~1..HEAD  (files changed by executors)
└── for each changed file:
    └── opencode run --model minimax-m2.7 [scan_file prompt]
└── rebuild wiki/README.md + index.json
└── append to oro/logs/$DATE/05-wiki-update.md
```

### Phase 6: PR Push

```
push_pr.sh
└── git checkout -b oro/fix-YYYY-MM-DD
└── git push origin
└── gh pr create --title "[oro] ..." --body (from logs/$DATE/02-plan.md summary)
└── writes oro/logs/$DATE/06-pr.md (PR URL + summary)
```

---

## 5. Scheduling

oro registers a cron job at install time. Default: daily at midnight.

```cron
0 0 * * * cd /path/to/project && oro run >> /path/to/project/oro/logs/cron.log 2>&1
```

Users can reconfigure via:
```bash
oro schedule --cron "0 2 * * 1-5"   # Weekdays at 2am
oro schedule --disable               # Pause scheduling
```

---

## 6. UI Server

A lightweight Node.js server at `localhost:7070` serves:
- Static React app (built to `oro/server/static/`)
- REST API for log listing and content
- SSE endpoint for live run tailing (streams new log lines as they appear)

The server is daemonized on install using the system process manager (PM2 if available, otherwise a simple `nohup` background process with PID file).

---

## 7. Installation Flow

Single command:
```bash
curl -fsSL https://raw.githubusercontent.com/orohq/oro/main/install.sh | bash
```

Install script does:
1. Detect OS (Linux/macOS)
2. Check for Node.js >= 18, Git >= 2.30
3. Install OpenCode CLI if not present
4. Clone oro to `~/.oro/` (global installation)
5. `npm install && npm run build` in oro directory
6. Add `oro` to PATH via `.bashrc`/`.zshrc`
7. Run `oro init` in current directory (interactive: asks for OpenCode Go API key, GitHub token)
8. Start UI server daemonized
9. Print summary and first-run instructions

---

## 8. Configuration Schema

`oro/config.json`:
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

## 9. State Machine

Each oro run transitions through states stored in `oro/logs/$DATE/.state`:

```
IDLE → SCANNING → ANALYZING → ORCHESTRATING → EXECUTING → UPDATING_WIKI → PUSHING_PR → IDLE
                                                              ↓
                                                          FAILED (on unrecoverable error)
```

The UI reads `.state` via SSE to show live status. If a run is interrupted, it resumes from the last successful phase on next invocation (idempotent phases).

---

## 10. Key Design Invariants

1. **GLM-5 never writes code.** It only plans. Its output is always a structured markdown document.
2. **MiniMax M2.7 never reasons.** It only executes instructions it is given. Prompts for it are imperative, step-by-step, with no ambiguity.
3. **Kimi K2.5 never executes code.** It only translates plans into executor instructions.
4. **Every `opencode run` call is stateless.** No session is continued. Context is rebuilt from files each time.
5. **All agent output is written to files before being read by the next agent.** No output is piped directly. Files are the message bus.
6. **The wiki is the single source of truth about the codebase.** Agents do not read source code directly except in the scan phase (MiniMax) and execution phase (MiniMax executor). GLM-5 and Kimi only ever read the wiki.
7. **git is the undo mechanism.** Every executor commits atomically. If the run is bad, `git reset --hard HEAD~N` restores the codebase.
