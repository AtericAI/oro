#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../" && pwd)"
ORO_DIR="$PROJECT_ROOT/oro"
DATE=$(date +%Y-%m-%d)
export XDG_DATA_HOME="/tmp/oro-opencode-data"
mkdir -p "$XDG_DATA_HOME"
LOG_DIR="$ORO_DIR/logs/$DATE"
STATE_FILE="$LOG_DIR/.state"

# ── Setup ────────────────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
echo "STARTED $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ORO_DIR/logs/latest.log"

log() {
  echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$ORO_DIR/logs/latest.log"
}

set_state() {
  echo "$1" > "$STATE_FILE"
  echo "$1" > "$ORO_DIR/logs/.current_state"
  log "STATE: $1"
}

get_state() {
  [[ -f "$STATE_FILE" ]] && cat "$STATE_FILE" || echo "IDLE"
}

fail() {
  set_state "FAILED"
  log "ERROR: $1"
  exit 1
}

# ── Resume logic ─────────────────────────────────────────────────────────────
CURRENT_STATE=$(get_state)
FORCE=${FORCE:-false}

if [[ "$CURRENT_STATE" == "IDLE" || "$CURRENT_STATE" == "STARTED" || "$FORCE" == "true" ]]; then
  START_FROM="SCANNING"
elif [[ "$CURRENT_STATE" == "SCANNING" ]]; then
  START_FROM="SCANNING"
elif [[ "$CURRENT_STATE" == "SCANNING_DONE" ]]; then
  START_FROM="ANALYZING"
elif [[ "$CURRENT_STATE" == "ANALYZING_DONE" ]]; then
  START_FROM="ORCHESTRATING"
elif [[ "$CURRENT_STATE" == "ORCHESTRATING_DONE" ]]; then
  START_FROM="EXECUTING"
elif [[ "$CURRENT_STATE" == "EXECUTING_DONE" ]]; then
  START_FROM="UPDATING_WIKI"
elif [[ "$CURRENT_STATE" == "UPDATING_WIKI_DONE" ]]; then
  START_FROM="PUSHING_PR"
else
  START_FROM="SCANNING"
fi

log "Starting oro run. Date: $DATE. Resuming from: $START_FROM"
cd "$PROJECT_ROOT"

# ── Phase 1: Wiki Scan ────────────────────────────────────────────────────────
if [[ "$START_FROM" == "SCANNING" ]]; then
  set_state "SCANNING"
  bash "$SCRIPT_DIR/scan.sh" || fail "Wiki scan failed"
  set_state "SCANNING_DONE"
  START_FROM="ANALYZING"
fi

# ── Phase 2: Analysis ─────────────────────────────────────────────────────────
if [[ "$START_FROM" == "ANALYZING" ]]; then
  set_state "ANALYZING"
  bash "$SCRIPT_DIR/analyze.sh" || fail "Analysis failed"
  set_state "ANALYZING_DONE"
  START_FROM="ORCHESTRATING"
fi

# ── Phase 3: Orchestration ────────────────────────────────────────────────────
if [[ "$START_FROM" == "ORCHESTRATING" ]]; then
  set_state "ORCHESTRATING"
  bash "$SCRIPT_DIR/orchestrate.sh" || fail "Orchestration failed"
  set_state "ORCHESTRATING_DONE"
  START_FROM="EXECUTING"
fi

# ── Phase 4: Execution ────────────────────────────────────────────────────────
if [[ "$START_FROM" == "EXECUTING" ]]; then
  set_state "EXECUTING"
  bash "$SCRIPT_DIR/execute.sh" || fail "Execution failed"
  set_state "EXECUTING_DONE"
  START_FROM="UPDATING_WIKI"
fi

# ── Phase 5: Wiki Update ──────────────────────────────────────────────────────
if [[ "$START_FROM" == "UPDATING_WIKI" ]]; then
  set_state "UPDATING_WIKI"
  bash "$SCRIPT_DIR/update_wiki.sh" || fail "Wiki update failed"
  set_state "UPDATING_WIKI_DONE"
  START_FROM="PUSHING_PR"
fi

# ── Phase 6: PR Push ──────────────────────────────────────────────────────────
if [[ "$START_FROM" == "PUSHING_PR" ]]; then
  set_state "PUSHING_PR"
  bash "$SCRIPT_DIR/push_pr.sh" || log "WARNING: PR push failed (non-fatal)"
  set_state "IDLE"
fi

log "oro run complete."
