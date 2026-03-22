# ○ oro

**Open-source code quality engineer AI agent.**

oro scans your codebase, identifies the highest-impact quality problem, writes a fix plan, executes it, and opens a pull request — all autonomously, for pennies per run.

---

## How It Works

oro uses a three-model architecture on the [OpenCode Go plan](https://opencode.ai) to maximize quality-per-dollar:

| Role | Model | Job |
|------|-------|-----|
| **Analyst** | GLM-5 | Reads the wiki, finds the #1 bottleneck, writes a fix plan |
| **Orchestrator** | Kimi K2.5 | Decomposes plans into precise executor task files |
| **Executor** | MiniMax M2.7 | Follows instructions mechanically — scans files, writes code, commits |

Every run follows a fixed pipeline:

```
Scan → Analyze → Orchestrate → Execute → Update Wiki → Push PR
```

Files are the message bus. Git is the undo mechanism. Every `opencode run` call is stateless.

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/AtericAI/oro/main/install.sh | bash
```

### Prerequisites

- **Node.js** >= 18
- **Git** >= 2.30
- **OpenCode CLI** (installed automatically)
- **GitHub CLI** (`gh`) — optional, needed for PR push

### Manual Install

```bash
git clone https://github.com/AtericAI/oro ~/.oro
cd ~/.oro && npm install && npm run build
export PATH="$HOME/.oro/bin:$PATH"
```

---

## Quick Start

```bash
# Navigate to your project
cd your-project

# Initialize oro
oro init

# Run a full quality cycle
oro run

# Or run individual phases
oro scan          # Scan codebase into wiki
oro status        # Check current run status
oro logs          # View run history
oro ui            # Open dashboard at localhost:7070
```

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `oro init` | Initialize oro in the current project |
| `oro run` | Run a full quality cycle (scan → analyze → orchestrate → execute → push) |
| `oro run --force` | Force re-scan even if wiki is fresh |
| `oro scan` | Run only the wiki scan phase |
| `oro scan --force` | Force re-scan all files |
| `oro status` | Show status of current/last run |
| `oro logs` | List all run dates |
| `oro logs <YYYY-MM-DD>` | View logs for a specific date |
| `oro ui` | Start the UI server and open dashboard |
| `oro schedule` | Show current schedule |
| `oro schedule --cron "0 0 * * *"` | Set cron schedule |
| `oro schedule --disable` | Disable scheduled runs |
| `oro config` | View current configuration |

---

## Architecture

```
your-project/
├── oro/
│   ├── wiki/               # Codebase documentation (auto-generated)
│   │   ├── files/           # One .md per source file
│   │   ├── README.md        # Wiki navigation
│   │   └── index.json       # Machine-readable index
│   ├── logs/                # Run logs by date
│   │   └── YYYY-MM-DD/
│   │       ├── 00-scan.md
│   │       ├── 01-analysis.md
│   │       ├── 02-plan.md
│   │       ├── 03-orchestration.md
│   │       ├── executor_N_task.md
│   │       └── 04-execution-N.md
│   ├── prompts/             # Agent prompt files
│   ├── scripts/             # Phase orchestration scripts
│   ├── config.json          # Runtime configuration
│   ├── opencode.json        # OpenCode agent definitions
│   └── AGENTS.md            # Agent behavioral rules
├── .env.oro                 # Secrets (never committed)
└── opencode.json            # Root OpenCode config
```

### Key Invariants

- **GLM-5 never writes code.** It reads the wiki and writes plans.
- **MiniMax M2.7 never reasons.** It follows instructions mechanically.
- **Kimi K2.5 never executes.** It writes instruction documents.
- **Every `opencode run` call is stateless.** Context is rebuilt from files.
- **Files are the message bus.** Agents communicate through the filesystem.
- **Git is the undo mechanism.** Every executor commits atomically.

---

## UI Dashboard

The oro dashboard runs at `http://localhost:7070` and provides:

- **Live run status** with SSE updates
- **Log viewer** with rendered markdown
- **Wiki browser** with search and quality issue overview
- **One-click run trigger**

Start it with `oro ui` or during `oro init`.

---

## Configuration

### `oro/config.json`

```json
{
  "opencode": { "api_key": "$ORO_OPENCODE_KEY", "plan": "go" },
  "github": { "token": "$ORO_GITHUB_TOKEN", "base_branch": "main" },
  "scan": {
    "extensions": [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"],
    "max_file_size_kb": 500,
    "incremental": true
  },
  "execution": {
    "max_executors": 5,
    "test_command": "auto"
  },
  "schedule": { "cron": "0 0 * * *", "enabled": true },
  "ui": { "port": 7070 }
}
```

Secrets are stored in `.env.oro` (auto-created by `oro init`, never committed):

```
ORO_OPENCODE_KEY=your-api-key
ORO_GITHUB_TOKEN=your-github-token
```

---

## Cost

oro runs on the OpenCode Go fixed-cost plan. A typical run scans ~100 files for approximately:

| Phase | Model | Calls | Est. Cost |
|-------|-------|-------|-----------|
| Scan | MiniMax M2.7 | ~100 | $0.02 |
| Index | MiniMax M2.7 | 1 | <$0.01 |
| Analysis | GLM-5 | 1 | $0.03 |
| Orchestration | Kimi K2.5 | 1 | $0.02 |
| Execution | MiniMax M2.7 | 1-5 | $0.01-$0.05 |
| Wiki Update | MiniMax M2.7 | 1-10 | <$0.01 |
| **Total** | | | **~$0.10** |

---

## State Machine

```
IDLE → SCANNING → ANALYZING → ORCHESTRATING → EXECUTING → UPDATING_WIKI → PUSHING_PR → IDLE
                                                                                    ↗
                              (any phase) → FAILED ─────────────────────────────────
```

Runs are resumable. If a run fails, `oro run` will pick up from where it left off. Use `oro run --force` to restart from scratch.

---

## License

MIT
