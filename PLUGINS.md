# Plugins

Plugins extend the agent runtime itself — adding new endpoints, integrations, or background services. Every plugin declares a **manifest** specifying its environment variables, dependencies, post-install steps, and health checks. When deploying a plugin, the dashboard prompts for required configuration, validates dependencies, runs plugin-specific setup, and verifies the installation via health checks.

## Plugin Registry

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
| **Solidity Auditor** | Pashov Audit Group | — | AI-powered security auditor for Solidity smart contracts — runs 8 specialized agents in parallel (vector scan, math precision, access control, economic security, execution trace, invariant, periphery, first principles) |
| **Hello Plugin** | MultiClaw | — | Minimal example plugin demonstrating the plugin interface — use as a template for building custom plugins |

## Plugin Manifests

Every plugin ships with a manifest that defines:
- **Environment variables** — required/optional config with descriptions, validation, and auto-generate support
- **Dependencies** — other plugins that must be installed first (validated before deploy)
- **Post-install steps** — ordered commands that run after cloning (install packages, start services, generate keys)
- **Uninstall steps** — cleanup commands that run when removing a plugin (unregister daemons, purge packages, remove data, uninstall CLIs)
- **Health checks** — verification that the plugin is installed and working (CLI commands, HTTP endpoints, Python imports)

New plugins added to the registry should follow this manifest standard. See the [Plugin Manifest Standard](#plugin-manifest-standard) in DOCUMENTATION.md.
