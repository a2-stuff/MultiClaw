<p align="center">
  <img src="MultiClaw_Icon.png" alt="MultiClaw" width="200" /><br />
  <img src="MultiClaw_GIF_Dashboard.gif" alt="MultiClaw" width="1200" />
</p>



# MultiClaw

**Distributed AI agent management platform.** Run, manage, and orchestrate fleets of AI agents across your infrastructure from a single dashboard.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Node.js 20](https://img.shields.io/badge/Node.js-20-339933.svg?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**AI Providers:**
[![Anthropic](https://img.shields.io/badge/Anthropic-Claude-d4a373.svg?logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991.svg?logo=openai&logoColor=white)](https://openai.com/)
[![Google Gemini](https://img.shields.io/badge/Google-Gemini-4285F4.svg?logo=googlegemini&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-API-6366f1.svg)](https://openrouter.ai/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-V3%20%7C%20R1-0055ff.svg)](https://www.deepseek.com/)

**Platforms:**
[![Ubuntu](https://img.shields.io/badge/Ubuntu-E95420.svg?logo=ubuntu&logoColor=white)](https://ubuntu.com/)
[![Debian](https://img.shields.io/badge/Debian-A81D33.svg?logo=debian&logoColor=white)](https://www.debian.org/)
[![Fedora](https://img.shields.io/badge/Fedora-51A2DA.svg?logo=fedora&logoColor=white)](https://fedoraproject.org/)
[![Arch Linux](https://img.shields.io/badge/Arch_Linux-1793D1.svg?logo=archlinux&logoColor=white)](https://archlinux.org/)
[![macOS](https://img.shields.io/badge/macOS-000000.svg?logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![Windows](https://img.shields.io/badge/Windows-0078D4.svg?logo=windows&logoColor=white)](https://www.microsoft.com/windows/)

**Infrastructure:**
[![Docker](https://img.shields.io/badge/Docker-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tailscale](https://img.shields.io/badge/Tailscale-242424.svg?logo=tailscale&logoColor=white)](https://tailscale.com/)
[![Let's Encrypt](https://img.shields.io/badge/Let's_Encrypt-003A70.svg?logo=letsencrypt&logoColor=white)](https://letsencrypt.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57.svg?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF.svg?logo=vite&logoColor=white)](https://vite.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-06B6D4.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Express.js](https://img.shields.io/badge/Express.js-000000.svg?logo=express&logoColor=white)](https://expressjs.com/)
[![WebSocket](https://img.shields.io/badge/WebSocket-010101.svg?logo=socketdotio&logoColor=white)](#)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F.svg?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)

> GitHub: [a2-stuff/MultiClaw](https://github.com/a2-stuff/MultiClaw) — Twitter: [@not_jarod](https://twitter.com/not_jarod) & [@MultiClaw](https://twitter.com/MultiClaw)

---

## Overview

MultiClaw is a self-hosted platform for managing fleets of AI agents. A central React dashboard connects to one or more Python agents running on localhost or remote machines. Each agent operates independently — with its own identity, skills, plugins, cron jobs, and configuration — while the dashboard gives you a single pane of glass to dispatch tasks, monitor health, stream responses in real time, orchestrate multi-agent workflows, and push configuration changes across your entire fleet.

**What you can do with MultiClaw:**

- Dispatch tasks using @mention tagging — type `@` to tag agents, or ask the dashboard directly
- Run tasks in parallel across multiple agents with automatic result synthesis
- Spawn isolated local agents with a single click — each gets its own virtualenv, port, and working directory under `~/.multiclaw/agents/`
- Register and manage remote agents running on any host in your infrastructure
- Give each agent a unique identity with a custom system prompt (supports `.md` file upload)
- Install skills from the marketplace (ClawHub, SkillSSH providers) and deploy them per agent
- Extend agents with git-based plugins — clone, install, and auto-setup with post-install scripts
- Schedule recurring tasks on any agent with per-agent cron jobs
- Build multi-agent workflows and delegate tasks between agents
- Share state and knowledge across agents with a common memory store
- Monitor system health (CPU, memory, disk, network) across all agents in real time
- Sync AI provider keys and settings from the dashboard to all connected agents at once
- Manage users with role-based access control and a full audit trail
- Secure zero-config networking between dashboard and agents using Tailscale

---

## Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS v4 |
| **Backend** | Express.js, SQLite, Drizzle ORM, SSE, WebSocket |
| **Agent** | Python 3.11+, FastAPI, uvicorn, pydantic-settings |
| **AI Providers** | Anthropic (Claude), OpenAI (GPT-4o), Google (Gemini), OpenRouter, DeepSeek |
| **Auth** | JWT (dashboard sessions), HMAC API keys (agents), bcrypt |
| **Authorization** | Role-based access control — `admin`, `operator`, `viewer` |
| **Security** | Helmet CSP, rate limiting, input validation, path traversal protection, audit logging |
| **Networking** | Tailscale (optional), dynamic CORS origin management, HTTPS/TLS, Let's Encrypt / certbot |
| **CLI / TUI** | Python Click + Rich (`manage.py`), Rich TUI (`tui.py`) |

---

## Project Structure

```
MultiClaw/
├── multi-claw-dashboard/     # React + Express dashboard
│   ├── client/               # React frontend (Vite + TailwindCSS)
│   ├── server/               # Express backend + API routes
│   ├── drizzle/              # Database schema and migrations
│   └── data/                 # SQLite database
├── multi-claw-agent/         # Python FastAPI agent
│   ├── src/                  # Agent source code
│   ├── skills/               # Installed skills
│   ├── plugins/              # Installed plugins
│   ├── cron_runs/            # Cron job execution history
│   └── tests/                # Test suite
├── manage.py                 # CLI management tool
├── tui.py                    # Interactive Rich TUI
├── install.sh                # Interactive installer wizard
└── ~/.multiclaw/agents/      # Spawned local agent instances
```

---

## Quick Start

### 1. Install the dashboard

```bash
git clone https://github.com/a2-stuff/MultiClaw.git
cd MultiClaw
./install.sh
```

The installer is a full interactive wizard. It will prompt you for:

- Dashboard port
- JWT secret (auto-generated if left blank)
- Admin email and password (auto-generated if left blank)
- CORS origins
- AI provider API keys (Anthropic, OpenAI, Google, OpenRouter, DeepSeek)
- Tailscale integration (optional)
- TLS / Let's Encrypt certificate setup (optional)

The admin user is seeded from `.env` on first startup — no separate registration step required.

### 2. Review your environment

```bash
# The installer writes .env for you. Key variables:
JWT_SECRET=<auto-generated>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<auto-generated>
CORS_ORIGINS=http://localhost:5173
```

### 3. Install as a system service

```bash
python manage.py install -y
```

This registers the dashboard (and optionally the local agent) as systemd services with automatic restart.

### 4. Open the dashboard

Navigate to `http://localhost:<port>` (or `https://` if TLS is configured). Log in with the admin credentials from your `.env`.

### 5. Generate an API key

Go to the **Keys** page and create an API key. You will need this when connecting additional agents.

### 6. Add an agent

**Spawn a local agent** directly from the dashboard — one click creates an isolated agent with its own virtualenv, port, and directory under `~/.multiclaw/agents/`.

**Or install an agent on a remote host:**

```bash
./install.sh   # choose the Agent option
```

The agent auto-connects to the dashboard on startup using the API key you provide during setup.

---

## Management CLI

All operations are available through `manage.py`:

```bash
# Service control
python manage.py start   [dashboard|agent|all]
python manage.py stop    [dashboard|agent|all]
python manage.py restart [dashboard|agent|all]

# Status and fleet management
python manage.py status                  # show health of all services
python manage.py agents                  # list all registered agents
python manage.py restart-agent <name>    # restart a specific named agent

# Logs
python manage.py logs [dashboard|agent]  # tail service logs

# Lifecycle
python manage.py install                 # register systemd services
python manage.py uninstall               # remove systemd services
python manage.py update                  # git pull, rebuild, restart

# Interactive TUI
python manage.py tui
```

### Rich TUI

The `tui.py` terminal interface provides a full dashboard experience without a browser — monitor agents, dispatch tasks, and stream logs directly from your terminal.

```bash
python manage.py tui
# or directly:
python tui.py
```

---

## Dashboard Features

### Agents

The Agents page is the primary fleet view. Each agent card shows its name, host, provider, model, and real-time health status. From an agent's detail view you get access to dedicated tabs:

- **Identity** — set a custom system prompt for the agent; upload a `.md` file to use as the prompt
- **Logs** — real-time log viewer with level and text filtering and auto-refresh
- **Skills** — view and manage skills installed on this agent
- **Plugins** — view and manage plugins installed on this agent
- **Tasks** — dispatch tasks and view task history with the ability to delete entries
- **Crons** — manage scheduled recurring commands for this agent
- **Settings** — per-agent configuration (provider, model, port, etc.)

### Tasks & @Mention Dispatch

The task dispatch system uses **@mention tagging** — type `@` in the prompt to get a Slack-style autocomplete dropdown showing all agents with live status indicators. Tagged agents appear as inline blue pills. The dispatch routing is automatic:

- **No agents tagged** → The dashboard answers directly using its built-in administrator profile and database access
- **1 agent tagged** → Direct dispatch to that agent
- **2+ agents tagged** → Parallel dispatch to all agents simultaneously, with a dashboard synthesis summarizing all results

Responses stream in real time via SSE and WebSocket. For parallel execution, each agent's result appears as it completes, followed by a unified **Dashboard Summary** card that synthesizes all responses. Full task history is stored and browsable.

### Skills Marketplace

Browse and install skills from the marketplace. Skills are callable tools that the AI model can invoke during a task. Two providers are supported:

- **ClawHub** — the built-in MultiClaw skill registry
- **SkillSSH** — install skills directly from SSH-accessible repositories

Skills are deployed per agent from the marketplace UI.

### Plugins

Plugins extend the agent runtime itself — adding new endpoints, integrations, or background services. Every plugin declares a **manifest** specifying its environment variables, dependencies, post-install steps, and health checks. When deploying a plugin, the dashboard prompts for required configuration, validates dependencies, runs plugin-specific setup, and verifies the installation via health checks.

**Plugin Registry:**

| Plugin | Author | Requires | Description |
|--------|--------|----------|-------------|
| **Superpowers** | Jesse Vincent | — | Complete development workflow skills for AI coding agents — TDD, systematic debugging, brainstorming, code review, parallel agents, and more |
| **Shannon** | KeygraphHQ | Docker, `ANTHROPIC_API_KEY` | Autonomous white-box AI pentester for web applications and APIs — analyzes source code, identifies attack vectors, and executes real exploits |
| **AgentPay SDK** | World Liberty Financial | Node.js, `AGENTPAY_RPC_URL` | Open SDK for agentic payments — let AI agents hold, transfer, and manage USD1 with operator-defined spending policies. Auto-generates wallets |
| **AgentPay Skill Pack** | World Liberty Financial | AgentPay SDK | AI agent skill pack for wallet setup, funding, transfers, approvals, and policy configuration with AgentPay SDK |
| **Bankr Agent** | BankrBot | Node.js, `BANKR_API_KEY` | Crypto trading, market analysis, and Polymarket prediction betting via the Bankr API — supports Base, Ethereum, Solana, and more. Auto-provisions wallets |
| **Browser Control** | MultiClaw | Python, pip | Browser automation via Playwright — navigate, fill forms, take screenshots, extract content, and manage tabs with 19 agent-facing tools |
| **Nmap Unleashed** | Sharkeonix | nmap, pipx | Advanced network scanning and enumeration via the `nu` CLI — automated discovery, service fingerprinting, vulnerability scanning, and structured HTML/XML reporting |
| **Docker** | MultiClaw | — | Install and manage Docker containers on the agent host — pull images, create/start/stop/remove containers, and control lifecycle |
| **Portainer** | MultiClaw | Docker | Install Portainer CE Docker management UI on the agent host for visual container management |
| **Tailscale** | MultiClaw | `TAILSCALE_AUTH_KEY` | Tailscale VPN mesh networking for secure, zero-config agent-to-dashboard communication with automatic peer discovery |
| **Hello Plugin** | MultiClaw | — | Minimal example plugin demonstrating the plugin interface — use as a template for building custom plugins |

**Plugin Manifests:** Every plugin ships with a manifest that defines:
- **Environment variables** — required/optional config with descriptions, validation, and auto-generate support
- **Dependencies** — other plugins that must be installed first (validated before deploy)
- **Post-install steps** — ordered commands that run after cloning (install packages, start services, generate keys)
- **Uninstall steps** — cleanup commands that run when removing a plugin (unregister daemons, purge packages, remove data, uninstall CLIs)
- **Health checks** — verification that the plugin is installed and working (CLI commands, HTTP endpoints, Python imports)

New plugins added to the registry should follow this manifest standard. See the [Plugin Manifest Standard](#plugin-manifest-standard) in DOCUMENTATION.md.

### Crons

Schedule recurring commands on any agent using standard cron expressions. Execution history is stored and viewable per agent. Results and any output are logged in `cron_runs/`.

### Templates

Agent templates let you define and reuse pre-configured agent setups — provider, model, skills, and base settings — so you can spin up consistent agents without repeating configuration.

### Workflows

The workflow builder lets you chain agents into sequences and directed acyclic graphs (DAGs) for multi-step orchestration. Define the flow of data between agents and trigger complex pipelines from a single action.

### Delegation

Agents can delegate sub-tasks to other agents. The delegation system routes tasks between agents transparently, enabling hierarchical and parallel work patterns without manual coordination.

### Memory

A shared memory and knowledge base spans across agents. Agents can read from and write to common memory, enabling persistent state, accumulated context, and knowledge sharing across the fleet.

### Sandbox

A sandboxed execution environment for running agent code and plugins in isolation, protecting the host system from unintended side effects.

### Audit Log

A complete audit trail of all actions taken in the platform — task dispatches, settings changes, plugin installs, user logins, and more — for compliance and debugging.

### Keys

Create and manage HMAC API keys used by agents to authenticate with the dashboard. Keys can be scoped and revoked at any time.

### Users

Role-based access control with three roles:

| Role | Capabilities |
|---|---|
| `admin` | Full access — manage users, keys, settings, all agents |
| `operator` | Dispatch tasks, manage agents, install skills and plugins |
| `viewer` | Read-only access to agents, tasks, and logs |

### Settings

- Configure AI provider API keys (Anthropic, OpenAI, Google, OpenRouter, DeepSeek)
- **Dashboard Profile** — customize the dashboard's AI administrator personality and view auto-injected live context (agent list, statuses, capabilities)
- Push settings to all connected agents simultaneously (config sync)
- Manage allowed CORS origins dynamically without restarting the server
- General dashboard configuration

### Help

In-app help page with FAQ and guides covering common setup scenarios, troubleshooting, and feature walkthroughs.

---

## Security

MultiClaw is designed for self-hosted, trusted environments with defence-in-depth throughout:

- **Authentication:** JWT tokens for dashboard sessions; HMAC-signed API keys for agent-to-dashboard communication; bcrypt password hashing.
- **Authorization:** Role-based access control (`admin`, `operator`, `viewer`) enforced on all API routes.
- **Input hardening:** Request body size limits (1 MB cap); strict input validation and allowlist-based parameter checking on all endpoints; path traversal protection for all file operations.
- **Transport security:** Helmet Content Security Policy headers; HTTPS/TLS support for both dashboard and agent; configurable and dynamically managed CORS origins.
- **Rate limiting:** Applied to authentication endpoints and all sensitive API routes.
- **Audit logging:** Every significant action is recorded with actor, timestamp, and outcome. Sanitized error messages prevent information leakage in responses.
- **Networking:** Optional Tailscale integration provides encrypted mesh networking between dashboard and remote agents with zero firewall configuration.

---

## TLS Setup

The `install.sh` wizard offers three TLS options:

1. **Skip** — configure later by editing `.env`
2. **Existing certificates** — provide paths to your `fullchain.pem` and `privkey.pem`
3. **Let's Encrypt (certbot)** — automated issuance:
   - Installs certbot if not present (apt, dnf, pacman, or snap)
   - Runs `certbot certonly --standalone` for your domain
   - Optionally sets up auto-renewal via cron (daily at 3 AM)
   - Grants file permissions for the service user
   - Writes `TLS_CERT` and `TLS_KEY` to `.env` automatically

**Prerequisites for certbot:**
- A domain name pointing to the server's public IP
- Port 80 accessible (HTTP challenge)
- No other service bound to port 80 during certificate issuance

**Manual setup (without the installer):**

```bash
sudo certbot certonly --standalone -d multiclaw.example.com
```

Then add to dashboard `.env`:

```
TLS_CERT=/etc/letsencrypt/live/multiclaw.example.com/fullchain.pem
TLS_KEY=/etc/letsencrypt/live/multiclaw.example.com/privkey.pem
```

---

## Tailscale Integration

For remote agents, MultiClaw supports Tailscale as an optional zero-config networking layer. When both the dashboard host and agent host are on the same Tailscale network, agents connect over the Tailscale IP — no port forwarding, firewall rules, or VPN configuration required. The installer walks you through enabling this during setup.

---

## Real-Time Communication

MultiClaw uses two real-time transport mechanisms in parallel:

- **Server-Sent Events (SSE):** Used for streaming task output and agent log tailing from the dashboard. Low overhead, works through most proxies.
- **WebSocket:** Bidirectional channel for lower-latency communication, live status updates, and interactive features across the fleet.

Both transports are available simultaneously; the client uses whichever is most appropriate for a given operation.

---

## License

MIT — see [LICENSE](LICENSE) for details.
