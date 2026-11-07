#!/usr/bin/env bash
#
# Brawl Ranked Overlay - one command installer.
#
#   curl -fsSL https://raw.githubusercontent.com/orev7s/brawl-ranked-overlay/main/install.sh | bash
#
# It checks (and installs, where it can) Git and Node.js, downloads this
# project, asks for your player tag and Brawl Stars API key, then starts the
# overlay. Re-running it updates the project and keeps your settings.
#
# Flags (optional, for people who like flags):
#   --tag '#ABC123'   --token 'eyJ...'   --dir ~/somewhere   --port 8786
#
set -euo pipefail

REPO_URL="https://github.com/orev7s/brawl-ranked-overlay.git"
MIN_NODE_MAJOR=20
NODE_VERSION="22.11.0"
DEFAULT_DIR="${HOME}/brawl-ranked-overlay"

# ---------------------------------------------------------------- tiny helpers
if [ -t 1 ]; then
  B=$'\033[1m'; DIM=$'\033[2m'; R=$'\033[0m'
  PINK=$'\033[38;5;205m'; GREEN=$'\033[38;5;114m'; YELLOW=$'\033[38;5;221m'; RED=$'\033[38;5;203m'
else
  B=""; DIM=""; R=""; PINK=""; GREEN=""; YELLOW=""; RED=""
fi
say()  { printf '%s\n' "$*"; }
step() { printf '\n%s\n' "${PINK}${B}==>${R} ${B}$*${R}"; }
ok()   { printf '%s\n' "  ${GREEN}ok${R}  $*"; }
warn() { printf '%s\n' "  ${YELLOW}!${R}   $*"; }
die()  { printf '\n%s\n' "${RED}${B}Stopped:${R} $*"; exit 1; }

banner() {
  printf '\n%s\n' "${PINK}${B}"
  cat <<'ART'
  ____                 _     ____        _     ____                  _
 | __ ) _ __ __ ___      _| |   |  _ \ __ _ _ __| | __|  _ \_   _____| |_ __ ___ _   _
 |  _ \| '__/ _` \ \ /\ / / |   | |_) / _` | '__| |/ / | |_) \ \ / / _ \ | '__/ _ \ | | |
 | |_) | | | (_| |\ V  V /| |   |  _ < (_| | |  |   <  |  _ < \ V /  __/ | | |  __/ |_| |
 |____/|_|  \__,_| \_/\_/ |_|   |_| \_\__,_|_|  |_|\_\ |_| \_\ \_/ \___|_|_|  \___|\__, |
                                                                                   |___/
ART
  printf '%s\n' "${R}${DIM}  a live Brawl Stars Ranked overlay for OBS${R}"
}

# Read one line from the terminal even when this script is piped from curl.
ask() {
  local prompt="$1" __var="$2"
  if [ -r /dev/tty ]; then
    printf '%s' "$prompt" > /dev/tty
    IFS= read -r "$__var" < /dev/tty || true
  else
    printf '%s' "$prompt"
    IFS= read -r "$__var" || true
  fi
}

# ------------------------------------------------------------------- arguments
DIR="$DEFAULT_DIR"
ARG_TAG=""; ARG_TOKEN=""; ARG_PORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tag)   ARG_TAG="${2:-}"; shift 2 ;;
    --token) ARG_TOKEN="${2:-}"; shift 2 ;;
    --dir)   DIR="${2:-}"; shift 2 ;;
    --port)  ARG_PORT="${2:-}"; shift 2 ;;
    -h|--help)
      say "Usage: install.sh [--tag '#ABC123'] [--token 'eyJ...'] [--dir PATH] [--port 8786]"
      exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

banner

# ---------------------------------------------------------------------- system
OS="$(uname -s)"
case "$OS" in
  Linux)  PLATFORM="linux" ;;
  Darwin) PLATFORM="darwin" ;;
  *) die "This installer supports macOS and Linux. On Windows, open Git Bash or WSL and run it there." ;;
esac
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) NODE_ARCH="x64" ;;
  arm64|aarch64) NODE_ARCH="arm64" ;;
  *) die "Unsupported CPU architecture: $ARCH" ;;
esac

# ------------------------------------------------------------------------- git
step "Checking Git"
if command -v git >/dev/null 2>&1; then
  ok "git found ($(git --version | awk '{print $3}'))"
else
  warn "Git is not installed. Trying to install it..."
  if [ "$PLATFORM" = "darwin" ]; then
    if command -v brew >/dev/null 2>&1; then
      brew install git
    else
      xcode-select --install 2>/dev/null || true
      say "  A macOS window may have opened to install the developer tools (this includes Git)."
      say "  Finish that, then run this command again."
      exit 1
    fi
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y git
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y git
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --noconfirm git
  else
    die "Could not install Git automatically. Install Git, then run this again."
  fi
  command -v git >/dev/null 2>&1 && ok "git installed" || die "Git install failed."
fi

# ------------------------------------------------------------------------ node
step "Checking Node.js (need version ${MIN_NODE_MAJOR}+)"
node_major() { node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1; }
if command -v node >/dev/null 2>&1 && [ "$(node_major)" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null; then
  ok "node found ($(node -v))"
else
  if command -v node >/dev/null 2>&1; then
    warn "Node $(node -v) is too old. Installing Node ${NODE_VERSION} privately (no sudo needed)."
  else
    warn "Node.js is not installed. Installing Node ${NODE_VERSION} privately (no sudo needed)."
  fi
  NODE_ROOT="${HOME}/.brawl-overlay/node"
  TARBALL="node-v${NODE_VERSION}-${PLATFORM}-${NODE_ARCH}.tar.gz"
  URL="https://nodejs.org/dist/v${NODE_VERSION}/${TARBALL}"
  mkdir -p "$NODE_ROOT"
  if curl -fsSL "$URL" -o "/tmp/${TARBALL}"; then
    tar -xzf "/tmp/${TARBALL}" -C "$NODE_ROOT" --strip-components=1
    export PATH="${NODE_ROOT}/bin:${PATH}"
    ok "node installed ($(node -v))"
  else
    die "Could not download Node.js. Install Node ${MIN_NODE_MAJOR}+ from https://nodejs.org and run this again."
  fi
fi

# -------------------------------------------------------------------- download
step "Downloading the overlay"
if [ -d "$DIR/.git" ]; then
  ok "Found an existing copy, updating it"
  git -C "$DIR" pull --ff-only || warn "Could not update (keeping your local copy)"
else
  mkdir -p "$(dirname "$DIR")"
  git clone --depth 1 "$REPO_URL" "$DIR"
  ok "Downloaded to ${DIR}"
fi
cd "$DIR"

# ------------------------------------------------------------------- settings
step "Your settings"
say "  ${DIM}We need two things: your player tag and your Brawl Stars API key.${R}"

TAG="${ARG_TAG}"
if [ -z "$TAG" ]; then
  while :; do
    ask "  Player tag (with the #, e.g. #2PQ0LRVGR): " TAG
    TAG="$(printf '%s' "$TAG" | tr -d ' ' | tr '[:lower:]' '[:upper:]' | sed 's/^#*//; s/^/#/; s/O/0/g')"
    if printf '%s' "$TAG" | grep -qE '^#[0-9A-Z]{3,15}$'; then break; fi
    warn "That does not look like a tag. Open your in-game profile to find it, it starts with #."
  done
fi
ok "Player tag: ${B}${TAG}${R}"

TOKEN="${ARG_TOKEN}"
if [ -z "$TOKEN" ]; then
  say ""
  say "  ${B}How to get your API key${R} (free, takes a minute):"
  say "    1. Open ${B}https://developer.brawlstars.com${R} and log in with Supercell ID."
  say "    2. Click ${B}Create New Key${R}, give it any name."
  say "    3. It asks for an ${B}allowed IP${R} - your key only works from that address."
  say "       The page shows your current public IP; paste that in."
  say "    4. Copy the long token (starts with ${DIM}eyJ${R}) and paste it below."
  say ""
  while :; do
    ask "  API token: " TOKEN
    TOKEN="$(printf '%s' "$TOKEN" | tr -d '[:space:]')"
    if printf '%s' "$TOKEN" | grep -qE '^ey[A-Za-z0-9._-]{30,}$'; then break; fi
    warn "That does not look like an API token. It is a long string starting with eyJ."
  done
fi
ok "API token saved (${#TOKEN} characters)"

PORT="${ARG_PORT:-8786}"
CONTROL_TOKEN="$( (command -v openssl >/dev/null 2>&1 && openssl rand -hex 10) || (head -c 20 /dev/urandom | od -An -tx1 | tr -d ' \n') )"

cat > "$DIR/.env" <<EOF
# Written by install.sh - your secrets stay on this machine.
BRAWL_API_TOKEN=${TOKEN}
PLAYER_TAG=${TAG}
PORT=${PORT}
POLL_MS=20000
CONTROL_TOKEN=${CONTROL_TOKEN}
DEMO=0
OVERLAY_CREDIT=
EOF
ok "Saved to ${DIR}/.env"

# ------------------------------------------------------------- quick key check
step "Checking your player tag and API key"
CHECK_URL="https://api.brawlstars.com/v1/players/%23$(printf '%s' "$TAG" | sed 's/^#//')"
CODE="$(curl -s -o /tmp/brawl-check.json -w '%{http_code}' -H "Authorization: Bearer ${TOKEN}" -H 'Accept: application/json' "$CHECK_URL" || echo 000)"
case "$CODE" in
  200) PLAYERNAME="$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' /tmp/brawl-check.json | head -1)"
       ok "Found you: ${B}${PLAYERNAME:-your account}${R}" ;;
  403) warn "The key is valid but was rejected for this IP (403). Set the allowed IP on developer.brawlstars.com to your current one."
       ;;
  401) warn "The key was rejected (401). Double-check you pasted the whole token."
       ;;
  404) warn "No player found for ${TAG} (404). Check the tag."
       ;;
  *)   warn "Could not verify right now (HTTP ${CODE}). The overlay will keep trying." ;;
esac

# ------------------------------------------------------------------------- run
step "Starting the overlay"
printf '\n%s\n' "  ${B}Open this in OBS as a Browser Source (1920x1080):${R}"
printf '%s\n'   "    ${GREEN}http://localhost:${PORT}/overlay${R}"
printf '\n%s\n' "  ${B}Control panel (start sessions, test animations):${R}"
printf '%s\n'   "    ${GREEN}http://localhost:${PORT}/control?key=${CONTROL_TOKEN}${R}"
printf '\n%s\n' "  ${DIM}Press Ctrl+C to stop. Run ${B}${DIM}./install.sh${R}${DIM}${DIM} again any time to restart.${R}"
printf '\n'

if [ "$PLATFORM" = "darwin" ] && command -v open >/dev/null 2>&1; then
  open "http://localhost:${PORT}/control?key=${CONTROL_TOKEN}" >/dev/null 2>&1 || true
fi

exec node server/index.js
