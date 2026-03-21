#!/bin/bash
# Tailscale VPN installation script for MultiClaw agents

set -e

echo "=== Tailscale Installation ==="

# Check if already installed
if command -v tailscale &>/dev/null; then
    echo "Tailscale is already installed: $(tailscale --version 2>/dev/null | head -1)"

    # Check if already connected
    if tailscale status &>/dev/null; then
        echo "Tailscale is connected."
        tailscale status | head -5
        exit 0
    fi

    echo "Tailscale installed but not connected."
else
    echo "Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
fi

# Authenticate with auth key
if [ -n "$TAILSCALE_AUTH_KEY" ]; then
    echo "Authenticating with Tailscale..."
    sudo tailscale up --authkey="$TAILSCALE_AUTH_KEY" --accept-routes 2>/dev/null || \
        tailscale up --authkey="$TAILSCALE_AUTH_KEY" --accept-routes 2>/dev/null || {
            echo "WARNING: tailscale up failed. You may need to authenticate manually."
            exit 1
        }

    sleep 2
    echo "Tailscale status:"
    tailscale status | head -5
    echo "Tailscale setup complete."
else
    echo "WARNING: TAILSCALE_AUTH_KEY not set. Tailscale installed but not authenticated."
    echo "Get an auth key from https://login.tailscale.com/admin/settings/keys"
    exit 1
fi
