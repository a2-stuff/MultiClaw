# Security

This document describes the security architecture and measures implemented in MultiClaw, a distributed AI agent management platform.

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Network Security](#network-security)
3. [Input Validation & Sanitization](#input-validation--sanitization)
4. [Agent Security](#agent-security)
5. [Audit & Monitoring](#audit--monitoring)
6. [Deployment Security Checklist](#deployment-security-checklist)
7. [Configuration Reference](#configuration-reference)
8. [Responsible Disclosure](#responsible-disclosure)

---

## Authentication & Authorization

### JWT Tokens

Dashboard sessions are authenticated with signed JWT tokens.

- Tokens have a configurable expiry (default: 24 hours).
- The JWT secret must be at least 32 characters. **The server refuses to start if the secret is absent or too short.**
- The client automatically logs out on receiving a `401 Unauthorized` response.

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### Password Policy & Hashing

- All passwords are hashed with bcrypt at cost factor 12 before storage.
- Minimum password length: 8 characters.
- Maximum password length: 128 characters.
- Email address format is validated server-side.

### Admin Account Seeding

On first startup, MultiClaw creates the initial admin account from environment variables:

```bash
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-strong-password-here
```

If these variables are absent, no admin account is created and the dashboard will be inaccessible until one is added directly in the database. Change the password immediately after the first login.

### Agent API Key Authentication

- Each agent is issued a unique API key with the `mca_` prefix (64 hex characters) at registration time.
- The dashboard authenticates to agents using HMAC-based comparison via Python's `hmac.compare_digest`, which is resistant to timing attacks.
- Keys can be rotated at any time through the dashboard Keys page.

### Role-Based Access Control

Three roles are supported:

| Role       | Capabilities                                             |
|------------|----------------------------------------------------------|
| `admin`    | Full access including user management and system config  |
| `operator` | Manage agents, tasks, skills, and plugins                |
| `viewer`   | Read-only access                                         |

### Rate Limiting

Failed authentication attempts are tracked per IP address:

- **Auth endpoints:** 10 failures per 15-minute window trigger a lockout for that IP.
- **Agent connect endpoints:** a separate, stricter rate limit tier applies.
- **General API endpoints:** a third tier covers all other authenticated routes.

---

## Network Security

### CORS

Allowed CORS origins can be managed at runtime through the dashboard Settings page — no server restart required. Origins can be added or removed dynamically.

For initial configuration, set the `CORS_ORIGINS` environment variable (comma-separated):

```bash
CORS_ORIGINS=https://dashboard.example.com,https://backup.example.com
```

Requests from origins not on the allowlist are rejected.

### HTTP Security Headers

[Helmet](https://helmetjs.github.io/) is used to apply standard HTTP security headers on all responses, including:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (when TLS is active)
- Additional Helmet defaults.

### Content Security Policy

A Content Security Policy (CSP) is applied. The policy is configurable via environment variables. Tighten the CSP for production deployments; development defaults are intentionally relaxed.

### TLS / HTTPS

Both the dashboard and agent support TLS via certificate files configured through environment variables. The `install.sh` wizard can automatically obtain free certificates via certbot and Let's Encrypt, or you can supply your own. See [TLS Setup](#tls-setup) below.

### Tailscale (Optional)

Agents and the dashboard can communicate over [Tailscale](https://tailscale.com/), a zero-config mesh VPN that uses encrypted WireGuard tunnels.

A `tailscale-only` binding mode is available that prevents the service from binding to any public network interface — connections are only accepted over the Tailscale network. See [Tailscale Setup](#tailscale-setup) below.

### WebSocket Authentication

WebSocket connections from the dashboard to agents require a valid JWT token. Unauthenticated WebSocket upgrade requests are rejected.

---

## Input Validation & Sanitization

### SSRF Protection

- Agent URLs are validated and restricted to HTTP and HTTPS schemes only.
- RFC1918 private IP ranges and loopback addresses are blocked on proxy routes to prevent server-side request forgery.

### Path Traversal Protection

- Skill and plugin filenames are sanitized before any filesystem operation.
- All resolved paths are confirmed to remain within their permitted directories before access is granted.

### File Upload Validation

- Uploaded filenames for skills and plugins are sanitized.
- File size limits are enforced on all upload endpoints.

### Request Body & Query Validation

- JSON request body size is capped at 1 MB.
- Input length limits and type checks are applied on all endpoints.
- Query parameters and request bodies are validated for expected types before use.

---

## Agent Security

### Isolation

Each spawned agent receives its own isolated environment under `~/.multiclaw/agents/`, including:

- A dedicated agent directory.
- A dedicated Python virtual environment (`venv`).
- Its own configuration, skills, and plugins.

No two agents share a runtime environment.

### API Keys

Every agent has a unique `mca_`-prefixed API key (64 hex characters) used for all dashboard-to-agent communication. Keys can be rotated through the dashboard Keys page.

### Agent Identity & System Prompt

Agent identity and system prompt are managed centrally from the dashboard. Agents do not self-configure their identity.

### Skill & Plugin Execution

- Skills are loaded via `importlib` exclusively from validated, allowlisted paths.
- Plugins are loaded only from their validated directories.
- Path containment is enforced before any load attempt.

### Cron Execution

Scheduled cron commands run in isolated subprocesses. Cron run output is logged and accessible from the dashboard.

---

## Audit & Monitoring

### Audit Logging

Security-relevant events are written to audit logs. Logged events include:

- Authentication failures and lockouts.
- Agent creation, spawning, stopping, and deletion.
- Task creation, modification, and deletion.
- Settings changes (including CORS origin management).
- Self-update and agent restart operations.

### Agent Health Monitoring

- The dashboard polls registered agents every 15 seconds to verify liveness.
- Spawned agent processes are monitored for unexpected termination (dead process detection).
- Agent status is reflected in real time on the dashboard.

### In-App Log Viewer

Agent logs are accessible directly from the dashboard agent detail page without requiring SSH access to the host.

---

## Deployment Security Checklist

Complete all of the following before deploying MultiClaw in a production environment:

**Authentication**
- [ ] Set a strong `JWT_SECRET` (32+ characters, randomly generated — see command above).
- [ ] Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before first startup, then change the password immediately after the initial login.
- [ ] Remove or rotate any default credentials.

**Network**
- [ ] Set `CORS_ORIGINS` to only the domains your dashboard is served from.
- [ ] Enable TLS — use the `install.sh` certbot wizard or provide existing certificates.
- [ ] Configure auto-renewal for Let's Encrypt certificates (see [TLS Setup](#tls-setup)).
- [ ] Use Tailscale for agent-to-dashboard communication where possible; consider `tailscale-only` mode.
- [ ] Set firewall rules to restrict agent ports (8100+) to the dashboard IP only.

**Agent Keys**
- [ ] Confirm each agent has a unique, freshly generated API key.
- [ ] Rotate API keys periodically through the dashboard Keys page.

**AI Provider Keys**
- [ ] Store all AI provider API keys (OpenAI, Anthropic, etc.) in `.env` files only — never commit them to version control.
- [ ] Use separate provider keys per deployment where possible to limit blast radius.
- [ ] Rotate provider keys if any key may have been exposed.

**Configuration & Secrets**
- [ ] Confirm `.env` files are not committed to version control (covered by `.gitignore`).
- [ ] Verify agent virtual environments are isolated (automatic with the spawn system).

**Audit & Monitoring**
- [ ] Confirm audit logging is active and logs are being retained.
- [ ] Monitor rate limiting logs for signs of brute force activity.
- [ ] Review agent health monitoring alerts.

---

## Configuration Reference

### CORS Configuration

CORS origins can be managed dynamically from the dashboard Settings page at runtime. Alternatively, pre-seed allowed origins in the environment:

```bash
# multi-claw-dashboard/.env
CORS_ORIGINS=https://dashboard.example.com,https://admin.example.com
```

### Admin Account Setup

```bash
# multi-claw-dashboard/.env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-on-first-login
JWT_SECRET=<48-byte base64 random string>
```

### TLS Setup

MultiClaw supports TLS for both the dashboard and agents. The `install.sh` wizard automates certificate setup.

**Option 1: Let's Encrypt (certbot) — recommended for production**

The installer can obtain and configure free TLS certificates automatically:

1. Installs certbot if not present (supports apt, dnf, pacman, snap).
2. Runs `certbot certonly --standalone -d your-domain.com`.
3. Writes certificate paths to `.env`.
4. Optionally configures auto-renewal via a daily cron job (3 AM with service restart).
5. Sets file permissions for the service user.

Prerequisites:
- A domain name pointing to the server's public IP.
- Port 80 accessible (HTTP-01 challenge).
- No other service binding port 80 during certificate issuance.

Manual certbot setup:

```bash
# Obtain certificate
sudo certbot certonly --standalone -d multiclaw.example.com --email you@example.com

# Configure auto-renewal with service restart
echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl restart multiclaw-dashboard'" | sudo crontab -
```

**Option 2: Existing certificates**

Dashboard (`multi-claw-dashboard/.env`):

```bash
TLS_CERT=/path/to/fullchain.pem
TLS_KEY=/path/to/privkey.pem
```

Agent (`.env`):

```bash
MULTICLAW_TLS_CERT=/path/to/fullchain.pem
MULTICLAW_TLS_KEY=/path/to/privkey.pem
```

**Option 3: No TLS (development or reverse-proxy deployments)**

Without TLS configured, services run on plain HTTP. This is acceptable for local development or when behind a reverse proxy (nginx, Caddy) that terminates TLS upstream.

**Certificate file permissions**

Certbot stores certificates under `/etc/letsencrypt/` with restrictive permissions. Adjust permissions so the service user can read them:

```bash
sudo chmod 0755 /etc/letsencrypt/live/ /etc/letsencrypt/archive/
sudo chmod 0644 /etc/letsencrypt/live/your-domain/fullchain.pem
sudo chmod 0640 /etc/letsencrypt/live/your-domain/privkey.pem
sudo chgrp your-group /etc/letsencrypt/live/your-domain/privkey.pem
```

### Tailscale Setup

**Dashboard (`multi-claw-dashboard/.env`):**

```bash
MULTICLAW_TAILSCALE_ENABLED=true
MULTICLAW_TAILSCALE_MODE=dual-stack   # or tailscale-only
MULTICLAW_TAILSCALE_TAG=tag:multiclaw-dashboard
```

**Agent (`.env`):**

```bash
MULTICLAW_TAILSCALE_ENABLED=true
MULTICLAW_TAILSCALE_MODE=dual-stack
MULTICLAW_TAILSCALE_TAG=tag:multiclaw-agent
```

When `MULTICLAW_TAILSCALE_MODE=tailscale-only`, the service does not bind to any public network interface and only accepts connections over the Tailscale network. This is the most secure option for agent-to-dashboard communication.

---

## Responsible Disclosure

If you discover a security vulnerability in MultiClaw, please report it responsibly.

**Do not open a public GitHub Issue for security vulnerabilities.** Instead:

1. Contact the maintainers directly through the repository's security contact information, or open a GitHub Issue marked with the `security` label if no private channel is available.
2. Include a clear description of the vulnerability, precise steps to reproduce, affected versions, and any relevant environment details.
3. Allow reasonable time — typically 90 days — for the issue to be assessed and patched before any public disclosure.

We take security reports seriously, will acknowledge receipt promptly, and will credit researchers by name in any related release notes unless anonymity is requested.
