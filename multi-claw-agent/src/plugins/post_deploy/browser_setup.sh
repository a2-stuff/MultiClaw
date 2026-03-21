#!/bin/bash
# Playwright browser automation setup for MultiClaw agents

set -e

echo "=== Browser Control (Playwright) Setup ==="

# Determine pip command
PIP="pip3"
if [ -n "$VIRTUAL_ENV" ]; then
    PIP="$VIRTUAL_ENV/bin/pip"
fi

echo "Installing Playwright..."
$PIP install "playwright>=1.40.0"

echo "Installing Chromium browser..."
python3 -m playwright install chromium

echo "Installing system dependencies..."
python3 -m playwright install-deps chromium 2>/dev/null || {
    echo "WARNING: Could not auto-install system dependencies."
    echo "You may need to manually install: libatomic1, libglib2.0-0, libnss3, libnspr4, libdbus-1-3, libatk1.0-0, libatspi2.0-0, libcups2, libdrm2, libxkbcommon0, libxcomposite1, libxdamage1, libxrandr2, libgbm1, libpango-1.0-0, libasound2"
}

# Verify
echo "Verifying Playwright installation..."
python3 -c "from playwright.sync_api import sync_playwright; print('Playwright OK')" && \
    echo "Browser Control setup complete." || \
    echo "WARNING: Playwright import failed. Check installation."
