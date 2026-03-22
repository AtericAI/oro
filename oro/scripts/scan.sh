#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../" && pwd)"
ORO_DIR="$PROJECT_ROOT/oro"
DATE=$(date +%Y-%m-%d)
LOG_FILE="$ORO_DIR/logs/$DATE/00-scan.md"
OPENCODE_KEY=$(cat "$ORO_DIR/config.json" | python3 -c "import sys,json; print(json.load(sys.stdin)['opencode']['api_key'])" 2>/dev/null || echo "${ORO_OPENCODE_KEY:-}")

log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG_FILE"; }

# Resolve OPENCODE_KEY from env if it starts with $
if [[ "$OPENCODE_KEY" == \$* ]]; then
  VAR_NAME="${OPENCODE_KEY:1}"
  OPENCODE_KEY="${!VAR_NAME}"
fi

mkdir -p "$(dirname "$LOG_FILE")"
echo "# Wiki Scan Log — $DATE" > "$LOG_FILE"
echo "" >> "$LOG_FILE"

cd "$PROJECT_ROOT"

# ── Enumerate source files ────────────────────────────────────────────────────
# Use git ls-files for tracked files, fallback to find
if git rev-parse --git-dir > /dev/null 2>&1; then
  # Get tracked files matching extensions
  FILES=$(git ls-files | grep -E "\.(ts|tsx|js|jsx|py|go|rs|java|cs|rb|php|vue|svelte)$" \
    | grep -v "node_modules" \
    | grep -v "\.min\." \
    | grep -v "dist/" \
    | grep -v "build/" \
    | grep -v "__pycache__" \
    | grep -v "oro/" \
    | sort || true)
else
  FILES=$(find . -type f \( \
    -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \
    -o -name "*.py" -o -name "*.go" -o -name "*.rs" \
    -o -name "*.java" -o -name "*.cs" -o -name "*.rb" -o -name "*.php" \
    \) \
    | grep -v "node_modules" | grep -v "\.min\." \
    | grep -v "dist/" | grep -v "build/" \
    | grep -v "__pycache__" | grep -v "oro/" \
    | sed 's|^./||' | sort || true)
fi

TOTAL=$(echo "$FILES" | grep -c . || echo 0)
log "Found $TOTAL source files to scan"

DONE=0
SKIPPED=0
FAILED=0

# ── Scan loop ─────────────────────────────────────────────────────────────────
while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  # Derive wiki output path
  SAFE_NAME=$(echo "$file" | sed 's|^./||' | tr '/' '_')
  WIKI_FILE="$ORO_DIR/wiki/files/${SAFE_NAME}.md"

  # Skip if fresh (modified within last 23 hours) unless changed in git
  if [[ -f "$WIKI_FILE" ]] && [[ $(find "$WIKI_FILE" -mmin -1380 2>/dev/null) ]]; then
    # Check if source file changed since wiki was written
    if git rev-parse --git-dir > /dev/null 2>&1; then
      GIT_MODIFIED=$(git status --porcelain "$file" 2>/dev/null | head -1)
      if [[ -z "$GIT_MODIFIED" ]]; then
        SKIPPED=$((SKIPPED + 1))
        continue
      fi
    else
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
  fi

  # Check file size (skip very large files)
  FILE_SIZE=$(wc -c < "$file" 2>/dev/null || echo 999999)
  MAX_SIZE=$((512 * 1024))  # 512KB
  if [[ $FILE_SIZE -gt $MAX_SIZE ]]; then
    log "SKIP (too large: ${FILE_SIZE}b): $file"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Run the wiki-scanner agent
  mkdir -p "$(dirname "$WIKI_FILE")"
  
  SCAN_OUTPUT=$(opencode run \
    --model "opencode-go/minimax-m2.7" \
    --agent "wiki-scanner" \
    "@oro/prompts/scan_file.md Read and document this file: $file" \
    --file "$file" 2>&1) && SCAN_OK=true || SCAN_OK=false

  if [[ "$SCAN_OK" == "true" ]]; then
    DONE=$((DONE + 1))
    log "OK [$DONE/$TOTAL]: $file"
  else
    FAILED=$((FAILED + 1))
    log "FAIL: $file"
    echo "$SCAN_OUTPUT" >> "$LOG_FILE"
  fi

done <<< "$FILES"

log "Scan complete. Done: $DONE, Skipped: $SKIPPED, Failed: $FAILED"

# ── Rebuild wiki index ────────────────────────────────────────────────────────
log "Rebuilding wiki index..."
opencode run \
  --model "opencode-go/minimax-m2.7" \
  --agent "wiki-index-builder" \
  "@oro/prompts/update_wiki_index.md Build the wiki README and index from all files in oro/wiki/files/" 2>&1 | tee -a "$LOG_FILE"

log "Wiki index updated."
