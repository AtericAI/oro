#!/usr/bin/env bash
set -e

# ── Constants ─────────────────────────────────────────────────────────────────
ORO_REPO="https://github.com/orohq/oro"
ORO_INSTALL_DIR="$HOME/.oro"
ORO_VERSION="${ORO_VERSION:-latest}"
NODE_MIN_VERSION="18"
GIT_MIN_VERSION="2.30"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

step_ok() {
  echo -e "  ${GREEN}✓${RESET} $1"
}

step_warn() {
  echo -e "  ${YELLOW}⚠${RESET} $1"
}

step_fail() {
  echo -e "  ${RED}✗${RESET} $1"
  exit 1
}

step_info() {
  echo -e "  ${BLUE}●${RESET} $1"
}

print_logo() {
  echo -e "${BOLD}"
  echo "  ┌─────────────────────────────────┐"
  echo "  │  ○  oro — code quality agent    │"
  echo "  └─────────────────────────────────┘"
  echo -e "${RESET}"
}

# ── Version comparison ────────────────────────────────────────────────────────
# Returns 0 if $1 >= $2
version_gte() {
  local IFS='.'
  local i
  local ver1=($1)
  local ver2=($2)

  for ((i=0; i<${#ver2[@]}; i++)); do
    local v1="${ver1[i]:-0}"
    local v2="${ver2[i]:-0}"
    if ((10#$v1 > 10#$v2)); then
      return 0
    elif ((10#$v1 < 10#$v2)); then
      return 1
    fi
  done
  return 0
}

# ── Preflight checks ─────────────────────────────────────────────────────────
check_node() {
  if ! command -v node &>/dev/null; then
    step_fail "Node.js is not installed. Install Node.js >= ${NODE_MIN_VERSION} and try again."
  fi

  local node_version
  node_version=$(node --version | sed 's/^v//')

  if version_gte "$node_version" "$NODE_MIN_VERSION"; then
    step_ok "Node.js v${node_version}"
  else
    step_fail "Node.js v${node_version} found, but >= v${NODE_MIN_VERSION} is required."
  fi
}

check_git() {
  if ! command -v git &>/dev/null; then
    step_fail "Git is not installed. Install Git >= ${GIT_MIN_VERSION} and try again."
  fi

  local git_version
  git_version=$(git --version | sed 's/git version //' | sed 's/ .*//')

  if version_gte "$git_version" "$GIT_MIN_VERSION"; then
    step_ok "Git v${git_version}"
  else
    step_fail "Git v${git_version} found, but >= v${GIT_MIN_VERSION} is required."
  fi
}

check_or_install_opencode() {
  if command -v opencode &>/dev/null; then
    step_ok "OpenCode CLI found"
  else
    step_info "Installing OpenCode CLI..."
    if curl -fsSL https://opencode.ai/install | bash &>/dev/null; then
      step_ok "OpenCode CLI installed"
    else
      step_warn "Could not auto-install OpenCode CLI. Install manually: https://opencode.ai"
    fi
  fi
}

check_gh_cli() {
  if command -v gh &>/dev/null; then
    step_ok "GitHub CLI (gh) found"
  else
    step_warn "GitHub CLI (gh) not found — PR push will not work."
    step_info "Install: https://cli.github.com"
  fi
}

# ── Clone or update oro ──────────────────────────────────────────────────────
clone_or_update_oro() {
  if [[ -d "$ORO_INSTALL_DIR" ]]; then
    step_info "Updating oro..."
    if git -C "$ORO_INSTALL_DIR" pull --quiet 2>/dev/null; then
      step_ok "Updated oro"
    else
      step_warn "Could not update oro (offline or dirty tree). Using existing installation."
    fi
  else
    step_info "Cloning oro..."
    if git clone --quiet "$ORO_REPO" "$ORO_INSTALL_DIR" 2>/dev/null; then
      step_ok "Cloned oro to $ORO_INSTALL_DIR"
    else
      step_fail "Failed to clone oro repository. Check your network and try again."
    fi
  fi

  step_info "Installing dependencies..."
  (cd "$ORO_INSTALL_DIR" && npm install --silent 2>/dev/null)
  step_ok "Dependencies installed"

  step_info "Building oro..."
  (cd "$ORO_INSTALL_DIR" && npm run build --silent 2>/dev/null)
  step_ok "Build complete"
}

# ── PATH setup ────────────────────────────────────────────────────────────────
setup_path() {
  local BIN_DIR="$ORO_INSTALL_DIR/bin"
  local CLI_TARGET="$ORO_INSTALL_DIR/dist/cli/index.js"

  mkdir -p "$BIN_DIR"

  # Create symlink
  if [[ -f "$CLI_TARGET" ]]; then
    ln -sf "$CLI_TARGET" "$BIN_DIR/oro"
    chmod +x "$BIN_DIR/oro"
    step_ok "Created oro symlink"
  else
    step_warn "CLI not found at $CLI_TARGET — build may have failed"
    return
  fi

  local PATH_LINE="export PATH=\"$BIN_DIR:\$PATH\""
  local ALREADY_IN_PATH=false

  # Check if already in PATH
  if echo "$PATH" | grep -q "$BIN_DIR"; then
    ALREADY_IN_PATH=true
  fi

  # Add to shell configs
  local ADDED=false
  for RC_FILE in "$HOME/.bashrc" "$HOME/.zshrc"; do
    if [[ -f "$RC_FILE" ]]; then
      if ! grep -q "/.oro/bin" "$RC_FILE" 2>/dev/null; then
        echo "" >> "$RC_FILE"
        echo "# oro" >> "$RC_FILE"
        echo "$PATH_LINE" >> "$RC_FILE"
        ADDED=true
      fi
    fi
  done

  if [[ "$ALREADY_IN_PATH" == "true" ]]; then
    step_ok "oro already in PATH"
  elif [[ "$ADDED" == "true" ]]; then
    step_ok "Added oro to PATH (restart shell or run: source ~/.zshrc)"
  else
    step_warn "Add this to your shell profile: $PATH_LINE"
  fi

  # Make it available in current session
  export PATH="$BIN_DIR:$PATH"
}

# ── Project init ──────────────────────────────────────────────────────────────
init_project() {
  echo ""
  step_info "Initializing oro in current directory..."

  # Check if we're in a git repo or reasonable project dir
  if [[ ! -d ".git" ]] && [[ ! -f "package.json" ]] && [[ ! -f "Makefile" ]] && [[ ! -f "pyproject.toml" ]]; then
    step_warn "This doesn't look like a project directory. Continuing anyway."
  fi

  if command -v oro &>/dev/null; then
    oro init
  elif [[ -x "$ORO_INSTALL_DIR/bin/oro" ]]; then
    "$ORO_INSTALL_DIR/bin/oro" init
  elif [[ -f "$ORO_INSTALL_DIR/dist/cli/index.js" ]]; then
    node "$ORO_INSTALL_DIR/dist/cli/index.js" init
  else
    step_warn "Could not run oro init — run it manually after restarting your shell"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
print_logo

echo -e "${BOLD}Preflight checks${RESET}"
echo -e "${DIM}──────────────────────────────────────────${RESET}"
check_node
check_git
check_or_install_opencode
check_gh_cli

echo ""
echo -e "${BOLD}Installation${RESET}"
echo -e "${DIM}──────────────────────────────────────────${RESET}"
clone_or_update_oro
setup_path

echo ""
echo -e "${BOLD}Project Setup${RESET}"
echo -e "${DIM}──────────────────────────────────────────${RESET}"
init_project

echo ""
echo -e "${GREEN}${BOLD}✓ oro installed successfully${RESET}"
echo ""
echo "  Quick start:"
echo "    oro run          # Run a full quality cycle"
echo "    oro scan         # Scan codebase into wiki"
echo "    oro status       # Check run status"
echo "    oro ui           # Open dashboard at http://localhost:7070"
echo "    oro --help       # All commands"
echo ""
