#!/usr/bin/env bash
set -euo pipefail

DATE=$(date +%Y-%m-%d)
export XDG_DATA_HOME="/tmp/oro-opencode-data"
mkdir -p "$XDG_DATA_HOME"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORO_DIR="$PROJECT_ROOT/oro"

cd "$PROJECT_ROOT"

opencode run </dev/null \
  --model "opencode-go/minimax-m2.7" \
  --agent "pr-pusher" \
  "@oro/prompts/push_pr.md Today's date is $DATE. Push the oro changes and create a PR." 2>&1

echo "PR push phase complete."
