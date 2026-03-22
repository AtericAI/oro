#!/usr/bin/env bash
set -euo pipefail

DATE=$(date +%Y-%m-%d)
export XDG_DATA_HOME="/tmp/oro-opencode-data"
mkdir -p "$XDG_DATA_HOME"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORO_DIR="$PROJECT_ROOT/oro"

mkdir -p "$ORO_DIR/logs/$DATE"

cd "$PROJECT_ROOT"

echo "Running GLM-5 analysis..."

opencode run </dev/null \
  --model "opencode-go/glm-5" \
  --agent "analyst" \
  "@oro/prompts/analyze.md Today's date is $DATE. Read the wiki and identify the single highest-impact code quality problem. Write your analysis to oro/logs/$DATE/01-analysis.md and your plan to oro/logs/$DATE/02-plan.md" 2>&1

# Verify outputs were written
if [[ ! -f "$ORO_DIR/logs/$DATE/01-analysis.md" ]]; then
  echo "ERROR: analyst did not write 01-analysis.md"
  exit 1
fi

if [[ ! -f "$ORO_DIR/logs/$DATE/02-plan.md" ]]; then
  echo "ERROR: analyst did not write 02-plan.md"
  exit 1
fi

echo "Analysis complete. Plan written to oro/logs/$DATE/02-plan.md"
