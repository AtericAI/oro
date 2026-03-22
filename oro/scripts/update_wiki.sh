#!/usr/bin/env bash
set -euo pipefail

DATE=$(date +%Y-%m-%d)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORO_DIR="$PROJECT_ROOT/oro"
LOG_FILE="$ORO_DIR/logs/$DATE/05-wiki-update.md"

cd "$PROJECT_ROOT"

echo "# Wiki Update Log — $DATE" > "$LOG_FILE"

# Get files changed by executors (last N commits from this run)
COMMIT_COUNT=$(find "$ORO_DIR/logs/$DATE" -name "executor_*_task.md" 2>/dev/null | wc -l | tr -d ' ')
CHANGED_FILES=""

if [[ "$COMMIT_COUNT" -gt 0 ]]; then
  CHANGED_FILES=$(git log --name-only --format="" "HEAD~${COMMIT_COUNT}..HEAD" 2>/dev/null \
    | grep -E "\.(ts|tsx|js|jsx|py|go|rs|java|cs|rb|php|vue|svelte)$" \
    | grep -v "^$" | sort -u || true)
fi

if [[ -z "$CHANGED_FILES" ]]; then
  echo "No source files changed. Wiki update skipped." | tee -a "$LOG_FILE"
  exit 0
fi

TOTAL=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
echo "Re-scanning $TOTAL changed file(s)..." | tee -a "$LOG_FILE"

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  [[ ! -f "$file" ]] && continue
  
  echo "Re-scanning: $file" | tee -a "$LOG_FILE"
  
  opencode run \
    --model "opencode-go/minimax-m2.7" \
    --agent "wiki-scanner" \
    "@oro/prompts/scan_file.md Read and document this file: $file" \
    --file "$file" 2>&1 | tee -a "$LOG_FILE"

done <<< "$CHANGED_FILES"

# Rebuild index
opencode run \
  --model "opencode-go/minimax-m2.7" \
  --agent "wiki-index-builder" \
  "@oro/prompts/update_wiki_index.md Rebuild the wiki README and index." 2>&1 | tee -a "$LOG_FILE"

echo "Wiki update complete." | tee -a "$LOG_FILE"
