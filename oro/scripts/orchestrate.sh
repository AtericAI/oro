#!/usr/bin/env bash
set -euo pipefail

DATE=$(date +%Y-%m-%d)
export XDG_DATA_HOME="/tmp/oro-opencode-data"
mkdir -p "$XDG_DATA_HOME"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORO_DIR="$PROJECT_ROOT/oro"

cd "$PROJECT_ROOT"

echo "Running Kimi K2.5 orchestration..."

opencode run </dev/null \
  --model "opencode-go/kimi-k2.5" \
  --agent "orchestrator" \
  "@oro/prompts/orchestrate.md Today's date is $DATE. Read oro/logs/$DATE/02-plan.md and write executor task files for each task." 2>&1

# Count executor task files created
TASK_COUNT=$(ls "$ORO_DIR/logs/$DATE/executor_"*"_task.md" 2>/dev/null | wc -l | tr -d ' ')

if [[ "$TASK_COUNT" -eq 0 ]]; then
  echo "ERROR: orchestrator created no executor task files"
  exit 1
fi

echo "Orchestration complete. $TASK_COUNT executor tasks created."
