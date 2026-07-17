#!/bin/sh
set -e

# ─── Colors ───────────────────────────────────────────────────────────────────

if [ -t 1 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
    RED='\033[1;31m'
    GREEN='\033[1;32m'
    YELLOW='\033[1;33m'
    CYAN='\033[1;36m'
    BOLD='\033[1m'
    DIM='\033[2m'
    RESET='\033[0m'
else
    RED='' GREEN='' YELLOW='' CYAN='' BOLD='' DIM='' RESET=''
fi

info()    { printf "${CYAN}▸${RESET} %s\n" "$1"; }
success() { printf "${GREEN}✔${RESET} %s\n" "$1"; }
warn()    { printf "${YELLOW}⚠${RESET} %s\n" "$1"; }
fail()    { printf "${RED}✖ %s${RESET}\n" "$1" >&2; exit 1; }

# ─── Banner ───────────────────────────────────────────────────────────────────

printf "\n"
printf "${BOLD}${CYAN}"
cat <<'EOF'
   ___  _   _ _ __ _   _ _ __  
  / __|| | | | '__| | | | '_ \ 
  \__ \| |_| | |  | |_| | |_) |
  |___/ \__, |_|   \__,_| .__/ 
        |___/            |_|    
EOF
printf "${RESET}"
printf "  ${DIM}Video downloader CLI — installer${RESET}\n\n"

# ─── Step 1: Ensure Node.js ──────────────────────────────────────────────────

NEED_NODE=0

if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node -v | sed 's/^v//')
    NODE_MAJOR=$(printf '%s' "$NODE_VERSION" | cut -d. -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        warn "Node.js v${NODE_VERSION} found but too old (need >= 18)"
        NEED_NODE=1
    else
        success "Node.js v${NODE_VERSION}"
    fi
else
    NEED_NODE=1
fi

if [ "$NEED_NODE" = "1" ]; then
    info "Node.js not found — installing via nvm..."

    # install nvm
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ ! -d "$NVM_DIR" ]; then
        curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | PROFILE=/dev/null bash >/dev/null 2>&1
    fi

    # load nvm into the current shell
    . "$NVM_DIR/nvm.sh" 2>/dev/null || true

    if ! command -v nvm >/dev/null 2>&1; then
        fail "Could not install nvm. Please install Node.js >= 18 manually:
  https://nodejs.org"
    fi

    # install latest LTS
    nvm install --lts >/dev/null 2>&1
    nvm use --lts >/dev/null 2>&1

    NODE_VERSION=$(node -v | sed 's/^v//')
    success "Node.js v${NODE_VERSION} installed via nvm"
fi

# ─── Step 2: Ensure npm prefix is writable (no sudo needed) ──────────────────

NPM_PREFIX=$(npm config get prefix 2>/dev/null || echo "")

# if the prefix is a system directory, redirect to home
case "$NPM_PREFIX" in
    /usr/*|/opt/*|/lib/*)
        info "Configuring npm to install in your home directory..."
        mkdir -p "$HOME/.npm-global"
        npm config set prefix "$HOME/.npm-global" 2>/dev/null
        NPM_PREFIX="$HOME/.npm-global"
        success "npm prefix set to ~/.npm-global"
        ;;
esac

# ensure the npm bin directory is on PATH for this session
NPM_BIN="$NPM_PREFIX/bin"
case ":$PATH:" in
    *":$NPM_BIN:"*) ;;
    *) export PATH="$NPM_BIN:$PATH" ;;
esac

# ─── Step 3: Install Syrup ───────────────────────────────────────────────────

printf "\n"
info "Installing Syrup..."

# --loglevel=error silences all the deprecation spam from transitive deps
if npm install -g syrup --loglevel=error 2>&1 | grep -v "^npm warn" ; then
    success "Syrup installed"
else
    fail "Installation failed. Please report this issue at:
  https://github.com/arnavsharma66/syrup/issues"
fi

# ─── Step 4: Add PATH to shell config (persistent) ───────────────────────────

add_to_shell_config() {
    SHELL_NAME=$(basename "${SHELL:-/bin/sh}")
    EXPORT_LINE=""
    CONFIG_FILE=""

    case "$SHELL_NAME" in
        bash)
            EXPORT_LINE="export PATH=\"$NPM_BIN:\$PATH\""
            CONFIG_FILE="$HOME/.bashrc"
            ;;
        zsh)
            EXPORT_LINE="export PATH=\"$NPM_BIN:\$PATH\""
            CONFIG_FILE="$HOME/.zshrc"
            ;;
        fish)
            EXPORT_LINE="set -gx PATH $NPM_BIN \$PATH"
            CONFIG_FILE="$HOME/.config/fish/config.fish"
            ;;
    esac

    if [ -n "$CONFIG_FILE" ] && [ -n "$EXPORT_LINE" ]; then
        if [ -f "$CONFIG_FILE" ] && grep -qF "$NPM_BIN" "$CONFIG_FILE" 2>/dev/null; then
            return  # already present
        fi
        printf '\n# Syrup (npm global binaries)\n%s\n' "$EXPORT_LINE" >> "$CONFIG_FILE"
    fi
}

# only patch shell config if we changed the prefix
case "$NPM_PREFIX" in
    "$HOME"/.npm-global) add_to_shell_config ;;
esac

# also handle nvm — add its loader to shell config if we just installed it
if [ "$NEED_NODE" = "1" ]; then
    SHELL_NAME=$(basename "${SHELL:-/bin/sh}")
    case "$SHELL_NAME" in
        bash)
            if ! grep -qF 'NVM_DIR' "$HOME/.bashrc" 2>/dev/null; then
                printf '\n# nvm (Node.js version manager)\nexport NVM_DIR="$HOME/.nvm"\n[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"\n' >> "$HOME/.bashrc"
            fi
            ;;
        zsh)
            if ! grep -qF 'NVM_DIR' "$HOME/.zshrc" 2>/dev/null; then
                printf '\n# nvm (Node.js version manager)\nexport NVM_DIR="$HOME/.nvm"\n[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"\n' >> "$HOME/.zshrc"
            fi
            ;;
        fish)
            # nvm.fish is separate; just note it
            ;;
    esac
fi

# ─── Step 5: Verify ──────────────────────────────────────────────────────────

if command -v syrup >/dev/null 2>&1; then
    SYRUP_VERSION=$(syrup --version 2>/dev/null || echo "unknown")
    success "syrup v${SYRUP_VERSION} is ready"
else
    success "Syrup installed"
    warn "Open a new terminal to start using it."
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

printf "\n"
printf "  ${GREEN}${BOLD}All done!${RESET}\n\n"
printf "    ${BOLD}syrup ${CYAN}<url>${RESET}      Download a video\n"
printf "    ${BOLD}syrup${RESET}            Launch interactive mode\n"
printf "\n"
printf "  ${DIM}Open a new terminal if the command isn't found yet.${RESET}\n\n"
