"""
Built-in plugin manifest definitions for health checks.

These manifests are the agent-side source of truth for built-in plugins
that weren't deployed via the registry (and thus don't have a manifest
stored in their plugin.json).
"""

BUILTIN_MANIFESTS: dict[str, dict] = {
    "browser-control": {
        "envVars": [],
        "dependencies": [],
        "systemRequirements": ["python", "pip"],
        "postInstallSteps": [
            {"id": "install-playwright", "label": "Install Playwright", "type": "command", "command": "pip3 install playwright>=1.40.0", "timeout": 120},
            {"id": "install-chromium", "label": "Install Chromium browser", "type": "command", "command": "playwright install chromium", "timeout": 300},
        ],
        "healthChecks": [
            {"type": "python-import", "importPath": "playwright.sync_api", "description": "Playwright Python module importable"},
            {"type": "command", "command": "python3 -c \"from playwright.sync_api import sync_playwright; print('Playwright OK')\"", "description": "Playwright functional"},
        ],
    },
    "browser_control": {  # alias — directory uses underscore
        "envVars": [],
        "dependencies": [],
        "systemRequirements": ["python", "pip"],
        "postInstallSteps": [],
        "healthChecks": [
            {"type": "python-import", "importPath": "playwright.sync_api", "description": "Playwright Python module importable"},
            {"type": "command", "command": "python3 -c \"from playwright.sync_api import sync_playwright; print('Playwright OK')\"", "description": "Playwright functional"},
        ],
    },
    "tailscale": {
        "envVars": [
            {"name": "TAILSCALE_AUTH_KEY", "description": "Tailscale auth key", "required": True, "secret": True},
        ],
        "dependencies": [],
        "systemRequirements": [],
        "postInstallSteps": [],
        "healthChecks": [
            {"type": "command", "command": "tailscale --version 2>/dev/null && echo 'Tailscale installed'", "description": "Tailscale CLI installed"},
            {"type": "command", "command": "tailscale status 2>/dev/null | head -1", "description": "Tailscale connected"},
        ],
    },
    "hello-plugin": {
        "envVars": [],
        "dependencies": [],
        "systemRequirements": [],
        "postInstallSteps": [],
        "healthChecks": [
            {"type": "command", "command": "echo 'Hello Plugin OK'", "description": "Plugin activates without error"},
        ],
    },
    "docker": {
        "envVars": [],
        "dependencies": [],
        "systemRequirements": [],
        "postInstallSteps": [],
        "healthChecks": [
            {"type": "command", "command": "docker --version", "description": "Docker CLI installed"},
            {"type": "command", "command": "docker info > /dev/null 2>&1 && echo 'Docker daemon OK'", "description": "Docker daemon running"},
        ],
    },
    "portainer": {
        "envVars": [],
        "dependencies": [{"slug": "docker", "reason": "Portainer runs as a Docker container"}],
        "systemRequirements": ["docker"],
        "postInstallSteps": [],
        "healthChecks": [
            {"type": "command", "command": "docker ps --filter name=portainer --format '{{.Status}}' | grep -q Up && echo 'Portainer running'", "description": "Portainer container running"},
            {"type": "http", "url": "https://localhost:9443", "description": "Portainer web UI accessible"},
        ],
    },
    "superpowers": {
        "envVars": [],
        "dependencies": [],
        "systemRequirements": [],
        "postInstallSteps": [],
        "healthChecks": [
            {"type": "file-exists", "filePath": "~/.claude/skills", "description": "Skills directory exists"},
        ],
    },
    "shannon": {
        "envVars": [
            {"name": "ANTHROPIC_API_KEY", "description": "Anthropic API key", "required": True, "secret": True},
        ],
        "dependencies": [],
        "systemRequirements": ["docker", "nodejs"],
        "postInstallSteps": [],
        "healthChecks": [
            {"type": "command", "command": "docker info > /dev/null 2>&1 && echo 'Docker OK'", "description": "Docker daemon running"},
            {"type": "command", "command": "test -n \"$ANTHROPIC_API_KEY\" && echo 'API key set'", "description": "Anthropic API key configured"},
        ],
    },
    "agentpay-sdk": {
        "envVars": [],
        "dependencies": [],
        "systemRequirements": ["nodejs", "pnpm"],
        "postInstallSteps": [],
        "healthChecks": [
            {"type": "command", "command": "agentpay admin status 2>/dev/null || echo 'AgentPay daemon not running'", "description": "AgentPay daemon responsive"},
        ],
    },
    "agentpay-skill-pack": {
        "envVars": [],
        "dependencies": [{"slug": "agentpay-sdk", "reason": "Skills require AgentPay SDK"}],
        "systemRequirements": [],
        "postInstallSteps": [],
        "healthChecks": [
            {"type": "command", "command": "agentpay admin status 2>/dev/null && echo 'SDK OK'", "description": "AgentPay SDK daemon reachable"},
            {"type": "file-exists", "filePath": "~/.claude/skills", "description": "Skills directory exists"},
        ],
    },
    "bankr-agent": {
        "envVars": [
            {"name": "BANKR_API_KEY", "description": "Bankr API key", "required": True, "secret": True},
        ],
        "dependencies": [],
        "systemRequirements": ["nodejs", "npm"],
        "postInstallSteps": [],
        "healthChecks": [
            {"type": "command", "command": "bankr whoami 2>/dev/null", "description": "Bankr CLI authenticated and responsive"},
        ],
    },
}


def get_builtin_manifest(slug: str) -> dict | None:
    """Return the built-in manifest for a plugin slug, or None."""
    return BUILTIN_MANIFESTS.get(slug)
