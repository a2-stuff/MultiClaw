#!/usr/bin/env bash
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

RED='\033[0;31m'

echo -e "${BOLD}${BLUE}"
echo "  __  __       _ _   _  ____ _"
echo " |  \/  |_   _| | |_(_)/ ___| | __ ___      __"
echo " | |\/| | | | | | __| | |   | |/ _\` \ \ /\ / /"
echo " | |  | | |_| | | |_| | |___| | (_| |\ V  V /"
echo " |_|  |_|\__,_|_|\__|_|\____|_|\__,_| \_/\_/"
echo -e "${NC}"
echo ""

# ---------------------------------------------------------------------------
# Dependency detection & installation helpers
# ---------------------------------------------------------------------------

# Detect package manager
detect_pkg_manager() {
  if command -v apt-get &> /dev/null; then
    PKG_MGR="apt"
  elif command -v dnf &> /dev/null; then
    PKG_MGR="dnf"
  elif command -v pacman &> /dev/null; then
    PKG_MGR="pacman"
  elif command -v brew &> /dev/null; then
    PKG_MGR="brew"
  else
    PKG_MGR=""
  fi
}

pkg_install() {
  local pkg_apt="${1}"
  local pkg_dnf="${2:-$1}"
  local pkg_pacman="${3:-$1}"
  local pkg_brew="${4:-$1}"

  case "$PKG_MGR" in
    apt)    sudo apt-get update -qq && sudo apt-get install -y -qq "$pkg_apt" ;;
    dnf)    sudo dnf install -y "$pkg_dnf" ;;
    pacman) sudo pacman -S --noconfirm "$pkg_pacman" ;;
    brew)   brew install "$pkg_brew" ;;
    *)
      echo -e "${RED}No supported package manager found. Please install '$pkg_apt' manually.${NC}"
      return 1
      ;;
  esac
}

# Check a command exists; if not, offer to install
require_cmd() {
  local cmd="$1"
  local pkg_apt="${2:-$1}"
  local pkg_dnf="${3:-$2}"
  local pkg_pacman="${4:-$2}"
  local pkg_brew="${5:-$2}"
  local manual_url="${6:-}"

  if command -v "$cmd" &> /dev/null; then
    return 0
  fi

  echo -e "${YELLOW}Required dependency '${cmd}' not found.${NC}"
  if [[ -n "$PKG_MGR" ]]; then
    read -p "  Install ${cmd} automatically? (Y/n): " auto_install
    if [[ ! "$auto_install" =~ ^[Nn]$ ]]; then
      echo "  Installing ${cmd}..."
      if pkg_install "$pkg_apt" "$pkg_dnf" "$pkg_pacman" "$pkg_brew"; then
        echo -e "  ${GREEN}${cmd} installed.${NC}"
        return 0
      fi
    fi
  fi

  if [[ -n "$manual_url" ]]; then
    echo -e "${RED}${cmd} is required. Install it from: ${manual_url}${NC}"
  else
    echo -e "${RED}${cmd} is required. Please install it and re-run the installer.${NC}"
  fi
  exit 1
}

# Check minimum version (major.minor) — usage: check_version "node" "20.0" "$(node -v)"
check_version() {
  local name="$1"
  local required="$2"
  local current="$3"

  # Strip leading 'v' or 'Python ' prefix
  current="${current#v}"
  current="${current#Python }"
  current="$(echo "$current" | grep -oE '^[0-9]+\.[0-9]+')"

  local req_major req_minor cur_major cur_minor
  req_major="${required%%.*}"
  req_minor="${required#*.}"
  cur_major="${current%%.*}"
  cur_minor="${current#*.}"

  if (( cur_major > req_major )) || { (( cur_major == req_major )) && (( cur_minor >= req_minor )); }; then
    return 0
  fi

  echo -e "${RED}${name} version ${required}+ is required, but found ${current}.${NC}"
  echo "  Please upgrade ${name} and re-run the installer."
  exit 1
}

# ---------------------------------------------------------------------------
# Dependency checks for Dashboard
# ---------------------------------------------------------------------------
check_dashboard_deps() {
  echo -e "${BOLD}Checking dashboard dependencies...${NC}"
  local ok=true

  detect_pkg_manager

  # Node.js 20+
  require_cmd "node" "nodejs" "nodejs" "nodejs" "node" "https://nodejs.org"
  local node_ver
  node_ver="$(node -v 2>/dev/null)"
  check_version "Node.js" "20.0" "$node_ver"
  echo -e "  ${GREEN}Node.js ${node_ver}${NC}"

  # npm (comes with node, but verify)
  require_cmd "npm" "npm" "npm" "npm" "npm"
  echo -e "  ${GREEN}npm $(npm -v 2>/dev/null)${NC}"

  # npx (part of npm)
  if ! command -v npx &> /dev/null; then
    echo -e "${RED}npx not found (should come with npm). Please reinstall Node.js.${NC}"
    exit 1
  fi

  # git (needed for plugin cloning, general usage)
  require_cmd "git" "git" "git" "git" "git"
  echo -e "  ${GREEN}git $(git --version 2>/dev/null | awk '{print $3}')${NC}"

  echo -e "${GREEN}All dashboard dependencies satisfied.${NC}"
  echo ""
}

# ---------------------------------------------------------------------------
# Dependency checks for Agent
# ---------------------------------------------------------------------------
check_agent_deps() {
  echo -e "${BOLD}Checking agent dependencies...${NC}"

  detect_pkg_manager

  # Python 3.11+
  require_cmd "python3" "python3" "python3" "python" "python3" "https://www.python.org"
  local py_ver
  py_ver="$(python3 --version 2>/dev/null)"
  check_version "Python" "3.11" "$py_ver"
  echo -e "  ${GREEN}${py_ver}${NC}"

  # pip
  if ! python3 -m pip --version &> /dev/null; then
    echo -e "${YELLOW}pip not found.${NC}"
    if [[ -n "$PKG_MGR" ]]; then
      read -p "  Install pip automatically? (Y/n): " auto_install
      if [[ ! "$auto_install" =~ ^[Nn]$ ]]; then
        case "$PKG_MGR" in
          apt)    sudo apt-get update -qq && sudo apt-get install -y -qq python3-pip ;;
          dnf)    sudo dnf install -y python3-pip ;;
          pacman) sudo pacman -S --noconfirm python-pip ;;
          brew)   echo "pip should come with Python via Homebrew." ;;
        esac
        if python3 -m pip --version &> /dev/null; then
          echo -e "  ${GREEN}pip installed.${NC}"
        else
          echo -e "${RED}pip is required. Please install it and re-run.${NC}"
          exit 1
        fi
      else
        echo -e "${RED}pip is required. Please install it and re-run.${NC}"
        exit 1
      fi
    else
      echo -e "${RED}pip is required. Install it with: python3 -m ensurepip --upgrade${NC}"
      exit 1
    fi
  fi
  echo -e "  ${GREEN}pip $(python3 -m pip --version 2>/dev/null | awk '{print $2}')${NC}"

  # venv module
  if ! python3 -m venv --help &> /dev/null 2>&1; then
    echo -e "${YELLOW}Python venv module not found.${NC}"
    if [[ -n "$PKG_MGR" ]]; then
      read -p "  Install python3-venv automatically? (Y/n): " auto_install
      if [[ ! "$auto_install" =~ ^[Nn]$ ]]; then
        case "$PKG_MGR" in
          apt)    sudo apt-get update -qq && sudo apt-get install -y -qq python3-venv ;;
          dnf)    echo "venv is included with python3 on Fedora." ;;
          pacman) echo "venv is included with python on Arch." ;;
          brew)   echo "venv is included with Python via Homebrew." ;;
        esac
        if python3 -m venv --help &> /dev/null 2>&1; then
          echo -e "  ${GREEN}venv module available.${NC}"
        else
          echo -e "${RED}venv module is required. Please install python3-venv and re-run.${NC}"
          exit 1
        fi
      else
        echo -e "${RED}venv module is required.${NC}"
        exit 1
      fi
    else
      echo -e "${RED}Python venv module is required. Install python3-venv and re-run.${NC}"
      exit 1
    fi
  else
    echo -e "  ${GREEN}venv module available${NC}"
  fi

  # git
  require_cmd "git" "git" "git" "git" "git"
  echo -e "  ${GREEN}git $(git --version 2>/dev/null | awk '{print $3}')${NC}"

  echo -e "${GREEN}All agent dependencies satisfied.${NC}"
  echo ""
}

# ---------------------------------------------------------------------------
# Tailscale setup wizard
# Usage: setup_tailscale "dashboard" | "agent"
# Sets globals: TAILSCALE_ENABLED, TAILSCALE_MODE, TAILSCALE_TAG
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# TLS certificate setup wizard (certbot / Let's Encrypt)
# Usage: setup_tls "dashboard" | "agent"
# Sets globals: TLS_CERT_PATH, TLS_KEY_PATH
# ---------------------------------------------------------------------------
setup_tls() {
  local role="${1}"
  TLS_CERT_PATH=""
  TLS_KEY_PATH=""

  echo ""
  read -p "Set up TLS/HTTPS with Let's Encrypt (certbot)? (y/n): " tls_enable
  if [[ ! "$tls_enable" =~ ^[Yy]$ ]]; then
    echo "Skipping TLS setup. You can configure it later in .env."
    return
  fi

  # Check for existing certificates
  read -p "Do you already have TLS certificates? (y/n): " has_certs
  if [[ "$has_certs" =~ ^[Yy]$ ]]; then
    read -p "Path to certificate file (fullchain.pem): " TLS_CERT_PATH
    read -p "Path to private key file (privkey.pem): " TLS_KEY_PATH
    if [[ ! -f "$TLS_CERT_PATH" ]]; then
      echo -e "${YELLOW}Warning: Certificate file not found at ${TLS_CERT_PATH}${NC}"
    fi
    if [[ ! -f "$TLS_KEY_PATH" ]]; then
      echo -e "${YELLOW}Warning: Key file not found at ${TLS_KEY_PATH}${NC}"
    fi
    echo -e "${GREEN}TLS configured with existing certificates.${NC}"
    return
  fi

  # Install certbot if not present
  if ! command -v certbot &> /dev/null; then
    echo "Certbot not found. Installing..."
    if command -v apt-get &> /dev/null; then
      sudo apt-get update -qq && sudo apt-get install -y -qq certbot
    elif command -v dnf &> /dev/null; then
      sudo dnf install -y certbot
    elif command -v pacman &> /dev/null; then
      sudo pacman -S --noconfirm certbot
    elif command -v snap &> /dev/null; then
      sudo snap install --classic certbot
      sudo ln -sf /snap/bin/certbot /usr/bin/certbot
    else
      echo -e "${YELLOW}Could not auto-install certbot. Install it manually:${NC}"
      echo "  https://certbot.eff.org/instructions"
      echo ""
      read -p "Press Enter after installing certbot, or Ctrl+C to skip TLS..."
      if ! command -v certbot &> /dev/null; then
        echo "Certbot still not found. Skipping TLS."
        return
      fi
    fi
  fi
  echo "Certbot version: $(certbot --version 2>&1)"

  # Get domain
  echo ""
  echo -e "${YELLOW}You need a domain name pointing to this server's public IP.${NC}"
  echo "Certbot will verify domain ownership via HTTP challenge (port 80 must be accessible)."
  echo ""
  read -p "Domain name (e.g. multiclaw.example.com): " DOMAIN
  if [[ -z "$DOMAIN" ]]; then
    echo "No domain provided. Skipping TLS."
    return
  fi

  read -p "Email for Let's Encrypt notifications: " LE_EMAIL
  if [[ -z "$LE_EMAIL" ]]; then
    echo "Email required for Let's Encrypt. Skipping TLS."
    return
  fi

  # Run certbot
  echo ""
  echo "Requesting certificate for ${DOMAIN}..."
  echo "Note: Port 80 must be accessible and not in use by another service."
  echo ""

  if sudo certbot certonly --standalone -d "${DOMAIN}" --email "${LE_EMAIL}" --agree-tos --non-interactive; then
    TLS_CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    TLS_KEY_PATH="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

    echo ""
    echo -e "${GREEN}TLS certificate obtained successfully!${NC}"
    echo "  Certificate: ${TLS_CERT_PATH}"
    echo "  Private key: ${TLS_KEY_PATH}"

    # Set up auto-renewal cron if not already present
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
      echo ""
      read -p "Set up automatic certificate renewal (recommended)? (y/n): " auto_renew
      if [[ "$auto_renew" =~ ^[Yy]$ ]]; then
        (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook \"systemctl restart multiclaw-${role} 2>/dev/null || true\"") | crontab -
        echo -e "${GREEN}Auto-renewal configured (daily at 3 AM).${NC}"
      fi
    else
      echo "Auto-renewal cron already exists."
    fi

    # Grant read access to cert files for the service user
    local CURRENT_USER=$(whoami)
    if [[ "$CURRENT_USER" != "root" ]]; then
      echo ""
      echo -e "${YELLOW}Granting read access to certificate files for user ${CURRENT_USER}...${NC}"
      sudo chmod 0755 /etc/letsencrypt/live/ /etc/letsencrypt/archive/
      sudo chmod 0644 "${TLS_CERT_PATH}"
      sudo chmod 0640 "${TLS_KEY_PATH}"
      sudo chgrp "$(id -gn ${CURRENT_USER})" "${TLS_KEY_PATH}"
    fi
  else
    echo ""
    echo -e "${YELLOW}Certbot failed. Common causes:${NC}"
    echo "  - Port 80 is in use (stop nginx/apache first)"
    echo "  - Domain doesn't point to this server's IP"
    echo "  - Firewall blocking port 80"
    echo ""
    echo "You can retry later with:"
    echo "  sudo certbot certonly --standalone -d ${DOMAIN}"
    echo ""
    echo "Continuing without TLS..."
  fi
}

setup_tailscale() {
  local role="${1}"

  read -p "Enable Tailscale secure networking? (y/n): " ts_enable
  if [[ ! "$ts_enable" =~ ^[Yy]$ ]]; then
    TAILSCALE_ENABLED=false
    TAILSCALE_MODE=""
    TAILSCALE_TAG=""
    return
  fi

  # Install Tailscale if not present
  if ! command -v tailscale &> /dev/null; then
    echo "Tailscale not found. Installing..."
    curl -fsSL https://tailscale.com/install.sh | sh
  else
    echo "Tailscale already installed: $(tailscale version 2>/dev/null | head -1)"
  fi

  # ACL prerequisite instructions
  echo ""
  echo -e "${YELLOW}Before proceeding, ensure your Tailscale ACL policy includes:${NC}"
  echo '  "tagOwners": {'
  echo '    "tag:multiclaw-agent": ["autogroup:admin"],'
  echo '    "tag:multiclaw-dashboard": ["autogroup:admin"]'
  echo '  }'
  echo "Configure at: https://login.tailscale.com/admin/acls"
  echo ""
  read -p "Have you configured the ACLs? (y/n): " acl_done
  if [[ ! "$acl_done" =~ ^[Yy]$ ]]; then
    echo "Please configure the ACLs and re-run the installer."
    exit 1
  fi

  # Bring up Tailscale with the appropriate tag
  if [[ "$role" == "dashboard" ]]; then
    TAILSCALE_TAG="tag:multiclaw-dashboard"
  else
    TAILSCALE_TAG="tag:multiclaw-agent"
  fi

  echo "Bringing up Tailscale with tag ${TAILSCALE_TAG}..."
  sudo tailscale up --advertise-tags="${TAILSCALE_TAG}"

  # Wait for tailscale status to succeed
  echo "Waiting for Tailscale to connect..."
  local attempts=0
  until tailscale status &> /dev/null; do
    attempts=$((attempts + 1))
    if [[ $attempts -ge 30 ]]; then
      echo "Tailscale did not connect within expected time. Check 'tailscale status'."
      exit 1
    fi
    sleep 2
  done
  echo -e "${GREEN}Tailscale connected.${NC}"

  # Binding mode
  read -p "Bind to Tailscale only? (no public access) (y/n): " ts_only
  if [[ "$ts_only" =~ ^[Yy]$ ]]; then
    TAILSCALE_MODE="tailscale-only"
  else
    TAILSCALE_MODE="dual-stack"
  fi

  TAILSCALE_ENABLED=true
  echo -e "${GREEN}Tailscale setup complete. Mode: ${TAILSCALE_MODE}, Tag: ${TAILSCALE_TAG}${NC}"
  echo ""
}

echo "What would you like to do?"
echo "  1) Install Dashboard (control hub)"
echo "  2) Install Agent (lightweight worker)"
echo "  3) Uninstall MultiClaw (remove everything)"
echo ""
read -p "Enter choice [1/2/3]: " choice

case $choice in
  1)
    echo -e "\n${GREEN}Installing MultiClaw Dashboard...${NC}\n"
    check_dashboard_deps
    cd multi-claw-dashboard
    echo "Installing dependencies..."
    npm install
    echo "Building client..."
    cd client && npm install && npm run build && cd ..
    echo "Setting up database..."
    mkdir -p data
    npx drizzle-kit generate 2>/dev/null || true
    npx tsx server/db/migrate.ts

    # -----------------------------------------------------------------------
    # Dashboard configuration wizard
    # -----------------------------------------------------------------------
    echo ""
    echo -e "${BOLD}${BLUE}━━━ Dashboard Configuration ━━━${NC}"
    echo ""

    # Port
    read -p "Dashboard port [3100]: " DASH_PORT
    DASH_PORT=${DASH_PORT:-3100}

    # JWT Secret
    echo ""
    echo -e "${YELLOW}JWT Secret (used to sign auth tokens — must be 32+ characters)${NC}"
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")
    echo "  Auto-generated: ${JWT_SECRET:0:20}..."
    read -p "Use this secret? (Y to accept, or type your own): " jwt_input
    if [[ -n "$jwt_input" && ! "$jwt_input" =~ ^[Yy]$ ]]; then
      JWT_SECRET="$jwt_input"
    fi

    # Admin account
    echo ""
    echo -e "${YELLOW}Admin Account${NC}"
    echo "  The first user will have full admin access."
    read -p "Admin email [admin@multiclaw.dev]: " ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-admin@multiclaw.dev}

    read -s -p "Admin password (leave blank to auto-generate): " ADMIN_PASSWORD
    echo ""
    if [[ -z "$ADMIN_PASSWORD" ]]; then
      ADMIN_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64url'))")
      echo -e "  Auto-generated password: ${BOLD}${ADMIN_PASSWORD}${NC}"
      echo -e "  ${YELLOW}Save this password — it will be stored in .env${NC}"
    fi

    # CORS origins
    echo ""
    DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    DEFAULT_CORS="http://localhost:${DASH_PORT},http://${DETECTED_IP}:${DASH_PORT}"
    read -p "CORS allowed origins [${DEFAULT_CORS}]: " CORS_ORIGINS
    CORS_ORIGINS=${CORS_ORIGINS:-$DEFAULT_CORS}

    # AI Provider keys
    echo ""
    echo -e "${BOLD}${BLUE}━━━ AI Provider Keys (optional — configure the ones you use) ━━━${NC}"
    echo ""
    echo "  These keys are pushed to all connected agents via config sync."
    echo "  You can also configure them later in Dashboard → Settings."
    echo ""

    read -p "Anthropic API key (sk-ant-...): " ANTHROPIC_KEY
    read -p "OpenAI API key (sk-...): " OPENAI_KEY
    read -p "Google/Gemini API key: " GOOGLE_KEY
    read -p "OpenRouter API key: " OPENROUTER_KEY
    read -p "DeepSeek API key: " DEEPSEEK_KEY

    # Tailscale setup
    setup_tailscale "dashboard"

    # TLS setup
    setup_tls "dashboard"

    # -----------------------------------------------------------------------
    # Write .env
    # -----------------------------------------------------------------------
    cat > .env << ENVEOF
# MultiClaw Dashboard Configuration
PORT=${DASH_PORT}
HOST=0.0.0.0
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
DB_PATH=./data/multiclaw.db
CORS_ORIGINS=${CORS_ORIGINS}

# Admin account (used to seed first user on startup)
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ENVEOF

    # Provider keys (only write non-empty ones)
    echo "" >> .env
    echo "# AI Provider Keys (synced to agents)" >> .env
    [[ -n "$ANTHROPIC_KEY" ]] && echo "ANTHROPIC_API_KEY=${ANTHROPIC_KEY}" >> .env
    [[ -n "$OPENAI_KEY" ]] && echo "OPENAI_API_KEY=${OPENAI_KEY}" >> .env
    [[ -n "$GOOGLE_KEY" ]] && echo "GOOGLE_API_KEY=${GOOGLE_KEY}" >> .env
    [[ -n "$OPENROUTER_KEY" ]] && echo "OPENROUTER_API_KEY=${OPENROUTER_KEY}" >> .env
    [[ -n "$DEEPSEEK_KEY" ]] && echo "DEEPSEEK_API_KEY=${DEEPSEEK_KEY}" >> .env

    # Tailscale
    if [[ "${TAILSCALE_ENABLED}" == "true" ]]; then
      cat >> .env << TSEOF

# Tailscale
MULTICLAW_TAILSCALE_ENABLED=true
MULTICLAW_TAILSCALE_MODE=${TAILSCALE_MODE}
MULTICLAW_TAILSCALE_TAG=${TAILSCALE_TAG}
TSEOF
    fi

    # TLS
    if [[ -n "${TLS_CERT_PATH}" && -n "${TLS_KEY_PATH}" ]]; then
      cat >> .env << TLSEOF

# TLS
TLS_CERT=${TLS_CERT_PATH}
TLS_KEY=${TLS_KEY_PATH}
TLSEOF
    fi

    echo ""
    echo -e "${GREEN}━━━ Dashboard installed! ━━━${NC}"
    echo ""
    echo -e "  Admin login:  ${BOLD}${ADMIN_EMAIL}${NC}"
    echo -e "  Password:     ${BOLD}${ADMIN_PASSWORD}${NC}"
    echo -e "  Port:         ${BOLD}${DASH_PORT}${NC}"
    if [[ -n "${TLS_CERT_PATH}" ]]; then
      echo -e "  HTTPS:        ${GREEN}enabled${NC}"
    fi
    echo ""
    echo "  Start with:"
    echo "    cd multi-claw-dashboard"
    echo "    PORT=${DASH_PORT} npx tsx server/index.ts"
    echo ""
    echo "  Or install as systemd service:"
    echo "    python manage.py install"
    ;;
  2)
    echo -e "\n${GREEN}Installing MultiClaw Agent...${NC}\n"
    check_agent_deps
    cd multi-claw-agent

    echo "Creating virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    echo "Installing dependencies..."
    pip install -e . -q

    # -----------------------------------------------------------------------
    # Agent configuration wizard
    # -----------------------------------------------------------------------
    echo ""
    echo -e "${BOLD}${BLUE}━━━ Agent Configuration ━━━${NC}"
    echo ""

    # Tailscale setup for agent (before URL prompts)
    setup_tailscale "agent"

    # Agent name
    read -p "Agent name [Agent-001]: " AGENT_NAME
    AGENT_NAME=${AGENT_NAME:-Agent-001}

    # Dashboard connection
    echo ""
    echo -e "${YELLOW}Dashboard Connection${NC}"
    echo "  To connect this agent to your dashboard, you need:"
    echo "    1. The dashboard URL (e.g. http://your-server:3100)"
    echo "    2. An API key from Dashboard → Keys page (starts with mck_)"
    echo ""

    if [[ "${TAILSCALE_ENABLED}" == "true" ]]; then
      echo "  Tailscale enabled — Dashboard URL will be discovered automatically."
      DASHBOARD_URL=""
    else
      while true; do
        read -p "Dashboard URL (e.g. http://192.168.1.10:3100): " DASHBOARD_URL
        if [[ -z "$DASHBOARD_URL" ]]; then
          echo -e "  ${RED}Dashboard URL is required for remote agents.${NC}"
        elif [[ ! "$DASHBOARD_URL" =~ ^https?:// ]]; then
          echo -e "  ${RED}URL must start with http:// or https://${NC}"
        else
          break
        fi
      done
    fi

    while true; do
      read -p "API Key (mck_...): " AGENT_API_KEY
      if [[ -z "$AGENT_API_KEY" ]]; then
        echo -e "  ${RED}API key is required. Generate one in Dashboard → Keys.${NC}"
      elif [[ ! "$AGENT_API_KEY" =~ ^mck_ ]]; then
        echo -e "  ${RED}API key should start with 'mck_'. Check Dashboard → Keys.${NC}"
      else
        break
      fi
    done

    # Agent URL
    DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    read -p "Agent port [8100]: " AGENT_PORT
    AGENT_PORT=${AGENT_PORT:-8100}
    read -p "Agent URL [http://${DETECTED_IP}:${AGENT_PORT}]: " AGENT_URL
    AGENT_URL=${AGENT_URL:-http://${DETECTED_IP}:${AGENT_PORT}}

    # AI Provider keys
    echo ""
    echo -e "${BOLD}${BLUE}━━━ AI Provider Keys (optional — or let dashboard push them) ━━━${NC}"
    echo ""
    echo "  If your dashboard has keys configured, they'll be synced automatically."
    echo "  Set keys here only if this agent should use different keys."
    echo ""

    read -p "Anthropic API key (sk-ant-..., blank to skip): " AGENT_ANTHROPIC_KEY
    read -p "OpenAI API key (sk-..., blank to skip): " AGENT_OPENAI_KEY
    read -p "Google/Gemini API key (blank to skip): " AGENT_GOOGLE_KEY
    read -p "OpenRouter API key (blank to skip): " AGENT_OPENROUTER_KEY
    read -p "DeepSeek API key (blank to skip): " AGENT_DEEPSEEK_KEY

    # Default provider
    echo ""
    echo "  Default AI provider:"
    echo "    1) Anthropic (Claude)"
    echo "    2) OpenAI (GPT)"
    echo "    3) Google (Gemini)"
    echo "    4) OpenRouter"
    echo "    5) DeepSeek"
    read -p "  Select [1]: " provider_choice
    case ${provider_choice:-1} in
      1) DEFAULT_PROVIDER="anthropic"; DEFAULT_MODEL="claude-sonnet-4-6" ;;
      2) DEFAULT_PROVIDER="openai"; DEFAULT_MODEL="gpt-4o" ;;
      3) DEFAULT_PROVIDER="gemini"; DEFAULT_MODEL="gemini-2.5-flash" ;;
      4) DEFAULT_PROVIDER="openrouter"; DEFAULT_MODEL="anthropic/claude-sonnet-4" ;;
      5) DEFAULT_PROVIDER="deepseek"; DEFAULT_MODEL="deepseek-chat" ;;
      *) DEFAULT_PROVIDER="anthropic"; DEFAULT_MODEL="claude-sonnet-4-6" ;;
    esac

    # TLS setup
    setup_tls "agent"

    # -----------------------------------------------------------------------
    # Write .env
    # -----------------------------------------------------------------------
    cat > .env << ENVEOF
# MultiClaw Agent Configuration
MULTICLAW_AGENT_NAME=${AGENT_NAME}
MULTICLAW_PORT=${AGENT_PORT}
MULTICLAW_HOST=0.0.0.0
MULTICLAW_API_KEY=${AGENT_API_KEY}
MULTICLAW_DASHBOARD_URL=${DASHBOARD_URL}
MULTICLAW_AGENT_URL=${AGENT_URL}
MULTICLAW_AUTO_REGISTER=true
MULTICLAW_DEFAULT_PROVIDER=${DEFAULT_PROVIDER}
MULTICLAW_DEFAULT_MODEL=${DEFAULT_MODEL}
ENVEOF

    # Provider keys (only write non-empty ones)
    echo "" >> .env
    echo "# AI Provider Keys" >> .env
    [[ -n "$AGENT_ANTHROPIC_KEY" ]] && echo "MULTICLAW_ANTHROPIC_API_KEY=${AGENT_ANTHROPIC_KEY}" >> .env
    [[ -n "$AGENT_OPENAI_KEY" ]] && echo "MULTICLAW_OPENAI_API_KEY=${AGENT_OPENAI_KEY}" >> .env
    [[ -n "$AGENT_GOOGLE_KEY" ]] && echo "MULTICLAW_GOOGLE_API_KEY=${AGENT_GOOGLE_KEY}" >> .env
    [[ -n "$AGENT_OPENROUTER_KEY" ]] && echo "MULTICLAW_OPENROUTER_API_KEY=${AGENT_OPENROUTER_KEY}" >> .env
    [[ -n "$AGENT_DEEPSEEK_KEY" ]] && echo "MULTICLAW_DEEPSEEK_API_KEY=${AGENT_DEEPSEEK_KEY}" >> .env

    # Tailscale
    if [[ "${TAILSCALE_ENABLED}" == "true" ]]; then
      cat >> .env << TSEOF

# Tailscale
MULTICLAW_TAILSCALE_ENABLED=true
MULTICLAW_TAILSCALE_MODE=${TAILSCALE_MODE}
MULTICLAW_TAILSCALE_TAG=${TAILSCALE_TAG}
TSEOF
    fi

    # TLS
    if [[ -n "${TLS_CERT_PATH}" && -n "${TLS_KEY_PATH}" ]]; then
      cat >> .env << TLSEOF

# TLS
MULTICLAW_TLS_CERT=${TLS_CERT_PATH}
MULTICLAW_TLS_KEY=${TLS_KEY_PATH}
TLSEOF
    fi

    echo ""
    echo -e "${GREEN}━━━ Agent installed! ━━━${NC}"
    echo ""
    echo -e "  Name:     ${BOLD}${AGENT_NAME}${NC}"
    echo -e "  Port:     ${BOLD}${AGENT_PORT}${NC}"
    echo -e "  Provider: ${BOLD}${DEFAULT_PROVIDER} / ${DEFAULT_MODEL}${NC}"
    if [[ -n "${TLS_CERT_PATH}" ]]; then
      echo -e "  HTTPS:    ${GREEN}enabled${NC}"
    fi
    echo ""
    echo "  Start the agent:"
    echo "    source .venv/bin/activate"
    if [[ -n "${TLS_CERT_PATH}" ]]; then
      echo "    uvicorn src.main:app --host 0.0.0.0 --port ${AGENT_PORT} --ssl-certfile ${TLS_CERT_PATH} --ssl-keyfile ${TLS_KEY_PATH}"
    else
      echo "    uvicorn src.main:app --host 0.0.0.0 --port ${AGENT_PORT}"
    fi
    echo ""
    echo "  The agent will automatically connect to the dashboard on startup."
    ;;
  3)
    echo ""
    echo -e "${RED}${BOLD}━━━ MultiClaw Uninstaller ━━━${NC}"
    echo ""
    echo -e "${YELLOW}This will completely remove MultiClaw from this system:${NC}"
    echo "  - Stop and remove systemd services (multiclaw-dashboard, multiclaw-agent)"
    echo "  - Remove spawned local agents (~/.multiclaw/agents/)"
    echo "  - Remove dashboard data (database, node_modules, build artifacts)"
    echo "  - Remove agent virtual environment"
    echo "  - Remove .env configuration files"
    echo "  - Remove certbot renewal cron entries (if any)"
    echo ""
    echo -e "${RED}${BOLD}This action is irreversible. All data will be lost.${NC}"
    echo ""
    read -p "Type 'UNINSTALL' to confirm: " confirm_uninstall
    if [[ "$confirm_uninstall" != "UNINSTALL" ]]; then
      echo "Aborted."
      exit 0
    fi

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    ERRORS=0

    # -----------------------------------------------------------------------
    # 1. Stop and remove systemd services
    # -----------------------------------------------------------------------
    echo ""
    echo -e "${BOLD}Stopping services...${NC}"
    for svc in multiclaw-dashboard multiclaw-agent; do
      if systemctl is-active --quiet "$svc" 2>/dev/null; then
        sudo systemctl stop "$svc" && echo -e "  ${GREEN}Stopped ${svc}${NC}" || { echo -e "  ${YELLOW}Failed to stop ${svc}${NC}"; ERRORS=$((ERRORS+1)); }
      else
        echo -e "  ${svc} not running"
      fi
      if systemctl is-enabled --quiet "$svc" 2>/dev/null; then
        sudo systemctl disable "$svc" 2>/dev/null && echo -e "  ${GREEN}Disabled ${svc}${NC}" || true
      fi
      if [[ -f "/etc/systemd/system/${svc}.service" ]]; then
        sudo rm -f "/etc/systemd/system/${svc}.service" && echo -e "  ${GREEN}Removed /etc/systemd/system/${svc}.service${NC}" || { echo -e "  ${YELLOW}Failed to remove unit file${NC}"; ERRORS=$((ERRORS+1)); }
      fi
    done
    sudo systemctl daemon-reload 2>/dev/null
    echo -e "  ${GREEN}Reloaded systemd daemon${NC}"

    # -----------------------------------------------------------------------
    # 2. Kill any remaining MultiClaw processes
    # -----------------------------------------------------------------------
    echo ""
    echo -e "${BOLD}Stopping remaining processes...${NC}"
    # Dashboard processes
    if [[ -f "${SCRIPT_DIR}/multi-claw-dashboard/.env" ]]; then
      DASH_PORT=$(grep -E '^PORT=' "${SCRIPT_DIR}/multi-claw-dashboard/.env" 2>/dev/null | cut -d= -f2)
      if [[ -n "$DASH_PORT" ]]; then
        DASH_PIDS=$(sudo lsof -ti:"${DASH_PORT}" 2>/dev/null || true)
        if [[ -n "$DASH_PIDS" ]]; then
          echo "$DASH_PIDS" | xargs kill 2>/dev/null || true
          echo -e "  ${GREEN}Killed dashboard processes on port ${DASH_PORT}${NC}"
        fi
      fi
    fi
    # Agent processes on common ports
    for port in 8100 8101 8102 8103 8104 8105; do
      AGENT_PIDS=$(sudo lsof -ti:"${port}" 2>/dev/null || true)
      if [[ -n "$AGENT_PIDS" ]]; then
        # Only kill if it looks like a multiclaw agent
        for pid in $AGENT_PIDS; do
          CMDLINE=$(ps -p "$pid" -o cmd= 2>/dev/null || true)
          if echo "$CMDLINE" | grep -q "multiclaw\|multi-claw\|multi_claw" 2>/dev/null; then
            kill "$pid" 2>/dev/null && echo -e "  ${GREEN}Killed agent process ${pid} on port ${port}${NC}" || true
          fi
        done
      fi
    done

    # -----------------------------------------------------------------------
    # 3. Remove spawned local agents
    # -----------------------------------------------------------------------
    echo ""
    echo -e "${BOLD}Removing spawned agents...${NC}"
    MULTICLAW_HOME="${HOME}/.multiclaw"
    if [[ -d "${MULTICLAW_HOME}/agents" ]]; then
      AGENT_COUNT=$(find "${MULTICLAW_HOME}/agents" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l)
      rm -rf "${MULTICLAW_HOME}/agents"
      echo -e "  ${GREEN}Removed ${AGENT_COUNT} spawned agent(s) from ${MULTICLAW_HOME}/agents/${NC}"
    else
      echo "  No spawned agents found"
    fi
    # Remove ~/.multiclaw if empty
    if [[ -d "${MULTICLAW_HOME}" ]]; then
      rmdir "${MULTICLAW_HOME}" 2>/dev/null && echo -e "  ${GREEN}Removed ${MULTICLAW_HOME}/${NC}" || echo "  ${MULTICLAW_HOME}/ has other contents, keeping it"
    fi

    # -----------------------------------------------------------------------
    # 4. Remove dashboard data
    # -----------------------------------------------------------------------
    echo ""
    echo -e "${BOLD}Cleaning dashboard...${NC}"
    DASH_DIR="${SCRIPT_DIR}/multi-claw-dashboard"
    if [[ -d "$DASH_DIR" ]]; then
      rm -f  "${DASH_DIR}/.env"                 && echo -e "  ${GREEN}Removed dashboard .env${NC}"
      rm -rf "${DASH_DIR}/node_modules"          && echo -e "  ${GREEN}Removed dashboard node_modules${NC}"
      rm -rf "${DASH_DIR}/client/node_modules"   && echo -e "  ${GREEN}Removed client node_modules${NC}"
      rm -rf "${DASH_DIR}/client/dist"           && echo -e "  ${GREEN}Removed client dist${NC}"
      rm -rf "${DASH_DIR}/data"                  && echo -e "  ${GREEN}Removed dashboard database${NC}"
    else
      echo "  Dashboard directory not found, skipping"
    fi

    # -----------------------------------------------------------------------
    # 5. Remove agent data
    # -----------------------------------------------------------------------
    echo ""
    echo -e "${BOLD}Cleaning agent...${NC}"
    AGENT_DIR="${SCRIPT_DIR}/multi-claw-agent"
    if [[ -d "$AGENT_DIR" ]]; then
      rm -f  "${AGENT_DIR}/.env"                && echo -e "  ${GREEN}Removed agent .env${NC}"
      rm -rf "${AGENT_DIR}/.venv"               && echo -e "  ${GREEN}Removed agent virtualenv${NC}"
      rm -rf "${AGENT_DIR}/__pycache__"         && echo -e "  ${GREEN}Removed agent __pycache__${NC}"
      rm -rf "${AGENT_DIR}/src/__pycache__"     && echo -e "  ${GREEN}Removed src __pycache__${NC}"
      rm -rf "${AGENT_DIR}/cron_runs"           && echo -e "  ${GREEN}Removed cron run history${NC}"
      # Clean plugin caches
      find "${AGENT_DIR}/plugins" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
      echo -e "  ${GREEN}Removed plugin caches${NC}"
    else
      echo "  Agent directory not found, skipping"
    fi

    # -----------------------------------------------------------------------
    # 6. Remove certbot renewal cron (if present)
    # -----------------------------------------------------------------------
    echo ""
    echo -e "${BOLD}Cleaning up cron entries...${NC}"
    if crontab -l 2>/dev/null | grep -q "multiclaw"; then
      crontab -l 2>/dev/null | grep -v "multiclaw" | crontab - 2>/dev/null
      echo -e "  ${GREEN}Removed MultiClaw certbot cron entries${NC}"
    else
      echo "  No MultiClaw cron entries found"
    fi

    # -----------------------------------------------------------------------
    # 7. Optionally remove the entire repository
    # -----------------------------------------------------------------------
    echo ""
    read -p "Also delete the entire MultiClaw repository (${SCRIPT_DIR})? (y/N): " delete_repo
    if [[ "$delete_repo" =~ ^[Yy]$ ]]; then
      echo -e "${YELLOW}Deleting ${SCRIPT_DIR} ...${NC}"
      cd /
      rm -rf "${SCRIPT_DIR}"
      echo -e "${GREEN}Repository deleted.${NC}"
    else
      echo "  Repository kept at ${SCRIPT_DIR}"
    fi

    # -----------------------------------------------------------------------
    # Done
    # -----------------------------------------------------------------------
    echo ""
    if [[ $ERRORS -eq 0 ]]; then
      echo -e "${GREEN}${BOLD}MultiClaw has been completely uninstalled.${NC}"
    else
      echo -e "${YELLOW}${BOLD}MultiClaw uninstalled with ${ERRORS} warning(s). Check output above.${NC}"
    fi
    echo ""
    ;;
  *)
    echo "Invalid choice. Please enter 1, 2, or 3."
    exit 1
    ;;
esac
