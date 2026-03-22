#!/usr/bin/env bash
set -euo pipefail

DATE=$(date +%Y-%m-%d)
export XDG_DATA_HOME="/tmp/oro-opencode-data"
mkdir -p "$XDG_DATA_HOME"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORO_DIR="$PROJECT_ROOT/oro"
MAX_EXECUTORS=5

cd "$PROJECT_ROOT"

# ── Find executor task files ──────────────────────────────────────────────────
TASK_FILES=()
while IFS= read -r -d '' f; do
  TASK_FILES+=("$f")
done < <(find "$ORO_DIR/logs/$DATE" -name "executor_*_task.md" -print0 | sort -z | head -z -n "$MAX_EXECUTORS")

TASK_COUNT=${#TASK_FILES[@]}

if [[ $TASK_COUNT -eq 0 ]]; then
  echo "No executor tasks found. Skipping execution phase."
  exit 0
fi

echo "Launching $TASK_COUNT executor(s) in parallel..."

PIDS=()
N=0

for TASK_FILE in "${TASK_FILES[@]}"; do
  N=$((N + 1))
  REPORT_FILE="$ORO_DIR/logs/$DATE/04-execution-$N.md"
  
  (
    echo "Executor $N starting: $TASK_FILE"
    
    MAX_LOOPS=5
    LOOP=0
    SUCCESS=false
    
    while [[ $LOOP -lt $MAX_LOOPS ]]; do
      LOOP=$((LOOP + 1))
      echo "Executor $N loop $LOOP/$MAX_LOOPS"
      
      opencode run </dev/null \
        --model "opencode-go/minimax-m2.7" \
        --agent "executor" \
        "@oro/prompts/execute.md Execute the task in this file. Write your completion report to $REPORT_FILE. Task file: $TASK_FILE" \
        --file "$TASK_FILE" 2>&1
      
      # Check if success by reading the report
      if [[ -f "$REPORT_FILE" ]]; then
        STATUS=$(grep -m1 "^\*\*Status:\*\*" "$REPORT_FILE" | sed 's/\*\*Status:\*\* //' || true)
        if [[ "$STATUS" == "SUCCESS" ]]; then
          echo "Executor $N: SUCCESS"
          SUCCESS=true
          break
        elif [[ "$STATUS" == "FAILED" ]]; then
          echo "Executor $N: FAILED (not retrying)"
          break
        fi
        # PARTIAL: retry
        echo "Executor $N: PARTIAL, retrying..."
      fi
    done
    
    if [[ "$SUCCESS" != "true" && $LOOP -ge $MAX_LOOPS ]]; then
      echo "Executor $N: reached max loops, committing partial work"
      git add -A
      git commit -m "[oro] executor-$N: partial work (max loops reached)" 2>/dev/null || true
    fi
  ) &
  
  PIDS+=($!)
done

# Wait for all executors
FAILED=0
for PID in "${PIDS[@]}"; do
  wait "$PID" || FAILED=$((FAILED + 1))
done

if [[ $FAILED -gt 0 ]]; then
  echo "WARNING: $FAILED executor(s) exited with error"
fi

echo "Execution phase complete."
