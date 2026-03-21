#!/bin/bash
# Docker CE installation script for MultiClaw agents
# Supports Debian/Ubuntu, RHEL/CentOS/Fedora, and Alpine

set -e

echo "=== Docker Installation ==="

# Check if Docker is already installed
if command -v docker &>/dev/null; then
    echo "Docker is already installed: $(docker --version)"
    if docker info &>/dev/null; then
        echo "Docker daemon is running."
        exit 0
    else
        echo "Docker installed but daemon not running. Attempting to start..."
        sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
        sleep 2
        if docker info &>/dev/null; then
            echo "Docker daemon started successfully."
            exit 0
        fi
        echo "WARNING: Could not start Docker daemon."
        exit 1
    fi
fi

echo "Docker not found. Installing..."

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "ERROR: Cannot detect OS. Please install Docker manually."
    exit 1
fi

case $OS in
    ubuntu|debian)
        echo "Installing Docker CE on $PRETTY_NAME..."
        sudo apt-get update -qq
        sudo apt-get install -y -qq ca-certificates curl gnupg
        sudo install -m 0755 -d /etc/apt/keyrings
        curl -fsSL "https://download.docker.com/linux/$OS/gpg" | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        sudo chmod a+r /etc/apt/keyrings/docker.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update -qq
        sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        ;;
    fedora|centos|rhel)
        echo "Installing Docker CE on $PRETTY_NAME..."
        sudo dnf -y install dnf-plugins-core 2>/dev/null || sudo yum -y install yum-utils
        sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo 2>/dev/null || \
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || \
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        ;;
    alpine)
        echo "Installing Docker on Alpine..."
        sudo apk add --no-cache docker docker-compose
        sudo rc-update add docker default 2>/dev/null || true
        ;;
    *)
        echo "Unsupported OS: $OS. Trying convenience script..."
        curl -fsSL https://get.docker.com | sh
        ;;
esac

# Start and enable Docker
echo "Starting Docker daemon..."
sudo systemctl enable --now docker 2>/dev/null || sudo service docker start 2>/dev/null || sudo rc-service docker start 2>/dev/null || true

# Add current user to docker group
echo "Adding $(whoami) to docker group..."
sudo usermod -aG docker "$(whoami)" 2>/dev/null || true

# Verify
sleep 2
if docker info &>/dev/null; then
    echo "Docker installed and running successfully: $(docker --version)"
else
    echo "Docker installed but may require re-login for group changes. Version: $(docker --version 2>/dev/null || echo 'unknown')"
fi
