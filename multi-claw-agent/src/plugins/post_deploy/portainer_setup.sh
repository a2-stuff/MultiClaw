#!/bin/bash
# Portainer CE installation script for MultiClaw agents
# Requires Docker to be installed and running

set -e

PORTAINER_PORT="${PORTAINER_PORT:-9443}"

echo "=== Portainer CE Installation ==="

# Verify Docker is available
if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker is not installed. Install the Docker plugin first."
    exit 1
fi

if ! docker info &>/dev/null; then
    echo "ERROR: Docker daemon is not running."
    exit 1
fi

# Check if Portainer is already running
if docker ps --format '{{.Names}}' | grep -q '^portainer$'; then
    echo "Portainer is already running."
    echo "Access at: https://localhost:${PORTAINER_PORT}"
    exit 0
fi

# Remove any stopped container with the same name
docker rm -f portainer 2>/dev/null || true

echo "Pulling Portainer CE image..."
docker pull portainer/portainer-ce:latest

echo "Creating data volume..."
docker volume create portainer_data 2>/dev/null || true

echo "Starting Portainer on port ${PORTAINER_PORT}..."
docker run -d \
    --name portainer \
    --restart=unless-stopped \
    -p "${PORTAINER_PORT}:9443" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v portainer_data:/data \
    portainer/portainer-ce:latest

sleep 3

if docker ps --format '{{.Names}}' | grep -q '^portainer$'; then
    echo "Portainer CE installed and running."
    echo "Access at: https://localhost:${PORTAINER_PORT}"
else
    echo "ERROR: Portainer container failed to start."
    docker logs portainer 2>/dev/null || true
    exit 1
fi
