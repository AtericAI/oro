#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../" && pwd)"
ORO_DIR="$PROJECT_ROOT/oro"
DATE=$(date +%Y-%m-%d)
LOG_FILE="$ORO_DIR/logs/$DATE/00-scan.md"

# ── Environment ──────────────────────────────────────────────────────────────
# Isolate opencode data to avoid "readonly database" / locking issues
export XDG_DATA_HOME="/tmp/oro-opencode-data"
mkdir -p "$XDG_DATA_HOME"

if [[ -f "$PROJECT_ROOT/.env.oro" ]]; then
  set -a
  source "$PROJECT_ROOT/.env.oro"
  set +a
fi

# Resolve OPENCODE_KEY: check config.json, then env, then .env.oro
# Handles JSON extraction via python3 (standard on mac/linux)
OPENCODE_KEY=$(cat "$ORO_DIR/config.json" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['opencode']['api_key'])" 2>/dev/null || echo "${ORO_OPENCODE_KEY:-}")

# If OPENCODE_KEY starts with $, treat as env var reference
if [[ "$OPENCODE_KEY" == \$* ]]; then
  VAR_NAME="${OPENCODE_KEY:1}"
  OPENCODE_KEY=$(eval "echo \${$VAR_NAME:-}")
fi

# Ensure it's exported for opencode CLI
export OPENCODE_API_KEY="${OPENCODE_KEY:-${ORO_OPENCODE_KEY:-}}"

if [[ -z "$OPENCODE_API_KEY" || "$OPENCODE_API_KEY" == "your_key_here" ]]; then
  echo "ERROR: ORO_OPENCODE_KEY is not set. Please update .env.oro with your OpenCode API key."
  exit 1
fi

log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG_FILE"; }

mkdir -p "$(dirname "$LOG_FILE")"
echo "# Wiki Scan Log — $DATE" > "$LOG_FILE"
echo "" >> "$LOG_FILE"

cd "$PROJECT_ROOT"

# ── Enumerate source files ────────────────────────────────────────────────────
if git rev-parse --git-dir > /dev/null 2>&1; then
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
# Use a for loop to avoid stdin consumption issues with opencode CLI
for file in $FILES; do
  [[ -z "$file" ]] && continue

  # Derive wiki output path
  SAFE_NAME=$(echo "$file" | sed 's|^./||' | tr '/' '_')
  WIKI_FILE="$ORO_DIR/wiki/files/${SAFE_NAME}.md"

  # Skip if fresh (modified within last 23 hours) unless changed in git
  if [[ -f "$WIKI_FILE" ]] && [[ $(find "$WIKI_FILE" -mmin -1380 2>/dev/null) ]]; then
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

  # Check file size
  FILE_SIZE=$(wc -c < "$file" 2>/dev/null || echo 999999)
  MAX_SIZE=$((512 * 1024))
  if [[ $FILE_SIZE -gt $MAX_SIZE ]]; then
    log "SKIP (too large): $file"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Run agent
  mkdir -p "$(dirname "$WIKI_FILE")"
  # Use </dev/null to prevent potential stdin hanging
  SCAN_OUTPUT=$(opencode run \
    --model "opencode-go/minimax-m2.7" \
    --agent "wiki-scanner" \
    "@oro/prompts/scan_file.md Read and document this file: $file" \
    --file "$file" </dev/null 2>&1) && SCAN_OK=true || SCAN_OK=false

  if [[ "$SCAN_OK" == "true" ]]; then
    DONE=$((DONE + 1))
    log "OK [$DONE/$TOTAL]: $file"
  else
    FAILED=$((FAILED + 1))
    log "FAIL: $file"
    echo "ERROR OUTPUT FOR $file:" >> "$LOG_FILE"
    echo "$SCAN_OUTPUT" >> "$LOG_FILE"
    echo "-----------------------------------" >> "$LOG_FILE"
  fi
done

log "Scan complete. Done: $DONE, Skipped: $SKIPPED, Failed: $FAILED"

# ── Rebuild wiki index ────────────────────────────────────────────────────────
log "Rebuilding wiki index..."
opencode run \
  --model "opencode-go/minimax-m2.7" \
  --agent "wiki-index-builder" \
  "@oro/prompts/update_wiki_index.md Build the wiki README and index from all files in oro/wiki/files/" </dev/null 2>&1 | tee -a "$LOG_FILE" || log "WARNING: Wiki index builder failed"

log "Wiki index updated."
