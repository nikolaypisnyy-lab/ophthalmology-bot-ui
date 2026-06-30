#!/bin/bash
set -e

echo "=== Gemini CLI Setup ==="

# Install Node.js 20 via NodeSource if missing or outdated
NODE_VERSION=$(node --version 2>/dev/null | grep -oP '\d+' | head -1 || echo 0)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "Node.js $(node --version) already installed"
fi

# Install or update Gemini CLI globally
echo "Installing @google/gemini-cli..."
npm install -g @google/gemini-cli

# Verify installation
GEMINI_BIN=$(which gemini 2>/dev/null || echo "")
if [ -z "$GEMINI_BIN" ]; then
    echo "ERROR: gemini binary not found after install"
    exit 1
fi
echo "Installed: $(gemini --version 2>/dev/null || gemini -v 2>/dev/null || echo 'ok')"

# Load GEMINI_API_KEY from existing .env
ENV_FILE="/root/app/deploy/.env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
    echo "Loaded env from $ENV_FILE"
fi

# Write gemini config if API key is present
if [ -n "$GEMINI_API_KEY" ]; then
    CONFIG_DIR="$HOME/.gemini"
    mkdir -p "$CONFIG_DIR"
    cat > "$CONFIG_DIR/settings.json" <<EOF
{
  "theme": "Default",
  "selectedAuthType": "api-key"
}
EOF
    # Store key in environment profile
    if ! grep -q 'GEMINI_API_KEY' /etc/environment 2>/dev/null; then
        echo "GEMINI_API_KEY=$GEMINI_API_KEY" >> /etc/environment
    else
        sed -i "s|GEMINI_API_KEY=.*|GEMINI_API_KEY=$GEMINI_API_KEY|" /etc/environment
    fi
    # Also add to root's .bashrc for interactive sessions
    if ! grep -q 'GEMINI_API_KEY' /root/.bashrc 2>/dev/null; then
        echo "export GEMINI_API_KEY=$GEMINI_API_KEY" >> /root/.bashrc
    fi
    echo "API key configured"
else
    echo "WARNING: GEMINI_API_KEY not found in $ENV_FILE — set it manually:"
    echo "  export GEMINI_API_KEY=your_key"
fi

echo ""
echo "=== Done ==="
echo "Run 'gemini' to start an interactive session"
echo "Run 'GEMINI_API_KEY=<key> gemini' to specify key inline"
