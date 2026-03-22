# Changelog

All notable changes to MultiClaw will be documented in this file.

## [1.4.0] - 2026-03-22

### Added
- **Task Polling in Dashboard UI** — The agent tasks tab now automatically polls for status updates every 2 seconds while any task is in "running" or "queued" state. Tasks transition to their final status (completed/failed) in real time without requiring a manual page refresh. Polling stops automatically once all tasks reach a terminal state.
- **Agent Task ID Tracking** — The dashboard now stores the agent-side `task_id` in the `agent_tasks` database table (`agent_task_id` column), enabling future re-checks of task status and better debugging of stuck tasks.
- **Solidity Auditor Plugin** — Added the Pashov Audit Group's Solidity security auditor to the plugin registry. Runs 8 specialized agents in parallel (vector scan, math precision, access control, economic security, execution trace, invariant, periphery, first principles) to audit Solidity smart contracts. Installs as a skill-based git plugin from `https://github.com/pashov/skills`.
- **Orchestrator Error Recovery** — When orchestrator task polling fails or times out, the `agent_tasks` database record is now properly updated to "failed" instead of being left permanently in "running" state.

### Fixed
- Agent tasks sent from the dashboard stayed in "running" status in the UI because the tasks tab only fetched once on mount and once after sending — now polls automatically
- Dashboard task proxy timed out after 120 seconds, prematurely marking long-running tasks (browser automation, SEO analysis) as failed — increased to 10 minutes
- Orchestrator `pollTaskCompletion` had the same 120-second timeout issue — increased to 10 minutes
- Tool schema generation crash when tools lacked callable handlers — now silently filters invalid tools instead of crashing the entire agentic loop

### Changed
- Task proxy poll interval changed from 1 second to 2 seconds to reduce unnecessary requests
- `AgentTasksTab` component uses silent polling (no loading spinner flash) during background refreshes
- Delete button on tasks now visible for all task statuses (was restricted to queued/running only)

### Database
- New column `agent_task_id` (text, nullable) added to `agent_tasks` table

---

## [1.3.0] - 2026-03-21

### Added
- **Plugin Uninstall Steps** — Manifests now support an `uninstallSteps` field alongside `postInstallSteps`. When a plugin is removed, the agent runs declared cleanup commands before deleting the plugin folder — unregistering daemons, purging packages, removing data directories, and cleaning up installed CLIs.
- **Uninstall Coverage for All Plugins** — Every plugin in the registry now has a complete uninstall procedure:
  - **Docker** — stops and disables the Docker daemon, purges all `docker-ce` packages via apt, removes `/var/lib/docker`, `/var/lib/containerd`, and `/etc/docker`
  - **Portainer** — removes the `portainer` container, deletes the `portainer_data` volume, and removes the image
  - **Tailscale** — disconnects from the Tailscale network (`tailscale down`), purges the `tailscale` package, removes `/var/lib/tailscale` and `/etc/tailscale`
  - **Browser Control** — removes Chromium browser files from `~/.cache/ms-playwright/`, uninstalls the Playwright Python package
  - **Nmap Unleashed** — runs `pipx uninstall nmapUnleashed` to remove the `nu` CLI
  - **Bankr Agent** — runs `npm uninstall -g @bankr/cli`
  - **AgentPay SDK** — runs the repo's `uninstall:cli-launcher` script or falls back to `npm uninstall -g agentpay`
  - **AgentPay Skill Pack** — removes all skills copied to `~/.claude/skills/` during installation
  - **Superpowers** — removes all skills copied to `~/.claude/skills/` during installation
- **Per-Agent Environment Isolation** — Each spawned agent instance now uses its own `.env` file under `~/.multiclaw/agents/<name>/.env`. The systemd service `EnvironmentFile` directive points to the per-agent file, so `MULTICLAW_PLUGINS_DIR` and `MULTICLAW_SKILLS_DIR` are scoped per agent without any global overrides.
- **Agent Connection Retry** — On startup, the agent retries its registration handshake with the dashboard using exponential backoff (0 / 2 / 5 / 10 / 20 seconds). If the dashboard is temporarily unavailable (e.g., restarting), the agent reconnects automatically instead of failing silently.
- **Built-in Plugin Source Directories** — `hello-plugin`, `docker`, and `portainer` now have source directories in the agent source tree (`multi-claw-agent/plugins/`), enabling the activate endpoint to copy them into per-agent plugin directories correctly.
- **Agent-Side Delete Error Surfacing** — When a plugin deletion request to an agent returns an error, the dashboard now captures and returns the agent's error message in the response. The UI shows a warning when the plugin was removed from the dashboard registry but the agent reported a problem.

### Fixed
- Git plugins (Superpowers, Nmap Unleashed, etc.) now show as **active** based on the `enabled` flag in `plugin.json` rather than requiring a Python class to be loaded in memory — they were incorrectly showing as inactive after each agent restart
- Plugin folders in the per-agent `plugins/` directory are now fully deleted when a plugin is removed — previously the folder persisted because the agent was reading from the wrong `plugins_dir` path
- Manifest uninstall steps for built-in plugins (non-git) are now executed on deletion — the built-in delete path previously skipped manifest cleanup and jumped directly to `shutil.rmtree`

### Changed
- `PluginManifest` dataclass gains `uninstall_steps: list[PluginPostStep]` field
- `parse_manifest()` reads `uninstallSteps` array from manifest JSON
- `ManifestRunner` gains `run_uninstall_steps()` method, mirroring `run_post_install_steps()`
- `GitPluginManager.uninstall()` runs manifest uninstall steps (if declared) before deleting the plugin directory; falls back to `uninstall.sh` only when no manifest steps are defined
- `uninstall_plugin` API endpoint reads the stored manifest from `plugin.json` and runs `uninstall_steps` before calling `shutil.rmtree`
- `uninstall.sh` fallback now inherits the real `HOME` and `PATH` from the process environment (was using a hardcoded restricted env with `HOME` set to the repo directory)

---

## [1.2.0] - 2026-03-21

### Added
- **Plugin Manifest System** — Every plugin in the registry now declares its environment variables, dependencies, post-install steps, and health checks in a structured manifest. This is the standard for all current and future plugins.
- **Environment Variable Prompting** — Deploying a plugin that requires configuration (API keys, network settings, auth tokens) now shows a configuration modal before deployment. Required fields are validated, optional fields are collapsible, and secret values are masked.
- **Auto-Generate Support** — Plugins like Bankr Agent and AgentPay SDK can auto-generate secrets, wallets, and API keys during installation. The UI offers an "Auto-generate" toggle for supported variables.
- **Plugin Dependency Validation** — The deploy flow checks that all plugin dependencies are installed on the target agent before proceeding. Portainer requires Docker, AgentPay Skill Pack requires AgentPay SDK, etc. Missing dependencies are shown with clear error messages.
- **Plugin Health Check Endpoints** — New `GET /api/plugins/{slug}/health` endpoint on each agent runs manifest-defined health checks (command, HTTP, Python import, file existence). Dashboard proxies health checks via `GET /api/plugin-registry/:id/health/:agentId`.
- **Health Indicators in UI** — The Plugins tab now shows a Health column with green/red status dots. Click to run health checks and see detailed results for failed checks.
- **Manifest-Driven Post-Install** — When a manifest is provided, the agent runs specific post-install steps instead of generic auto-detection. Steps run sequentially with per-step timeouts, progress tracking, and error reporting.
- **Per-Plugin Setup Scripts** — Docker, Portainer, Browser Control (Playwright), and Tailscale have dedicated setup scripts for system-level installation with multi-distro support.
- **10 Complete Plugin Manifests** — Superpowers, Shannon, AgentPay SDK, AgentPay Skill Pack, Bankr Agent, Docker, Portainer, Browser Control, Tailscale, and Hello Plugin all have full manifests with env vars, dependencies, post-deploy steps, and health checks.

### Changed
- Plugin deploy timeout increased from 60s to 600s for manifest-driven installs (system packages like Docker can take minutes)
- Plugin registry API responses now include parsed manifest objects
- Deploy route accepts `envVars` alongside `agentIds` and forwards both manifest and env vars to agents
- `agentRegistryPlugins` status enum expanded with `"configuring"` and `"installing"` states
- Undeploy and update routes now use `resolveAgentUrl()` for Tailscale compatibility (was using `agent.url` directly)
- Seed registry rewritten with `upsertPlugin()` helper that backfills manifests on existing entries

### Security
- SSL verification only disabled for localhost health checks (self-signed certs), not globally
- Python import paths validated against `^[a-zA-Z_][a-zA-Z0-9_.]*$` to prevent code injection
- File existence checks use `expanduser()` for tilde expansion
- Environment variable values injected via subprocess env (not shell interpolation) to prevent injection
- Env var values never logged — only key names are logged

### Database
- New migration `0016_plugin_manifests.sql`: adds `manifest` text column to `plugin_registry` table

---

## [1.1.0] - 2026-03-21

### Added
- **Dashboard Brain** — The dashboard now has its own LLM-powered administrator profile that answers queries directly when no agents are @mentioned. Customizable personality in Settings with auto-injected live system state (agent list, statuses, task counts).
- **@Mention Agent Tagging** — Replaced agent selection buttons with Slack-style @mention autocomplete in the task prompt. Type `@` to see a dropdown of agents with status indicators. Agents appear as inline blue pills and in a tag bar above the editor.
- **Parallel Task Execution** — When multiple agents are @mentioned, tasks dispatch to all agents simultaneously (not sequentially). Each agent works independently and results stream in real-time as they complete.
- **Dashboard Synthesis** — After all parallel agents complete, the dashboard automatically synthesizes a unified summary of all results, noting agreements, contradictions, and gaps.
- **Centralized Memory Integration** — Relevant knowledge base entries are injected into agent prompts before dispatch. Agent results and dashboard syntheses are written back to the knowledge base for future reference.
- **Orchestrations Database Table** — Task orchestrations are now persisted to SQLite (previously in-memory only), enabling task history queries and surviving server restarts.
- **Dashboard Profile Settings** — New "Dashboard Profile" section in Settings page with custom instructions textarea and live context preview showing auto-injected system state.
- **Keyword Fallback Search** — Memory context search falls back to keyword matching when OpenAI embeddings are unavailable, ensuring memory injection works with only an Anthropic API key.
- New SSE/WebSocket events: `dashboard_answer_start`, `dashboard_answer`, `synthesis_start`, `synthesis_complete`, `synthesis_error`

### Changed
- Task dispatch UI completely redesigned — `contenteditable` Lexical editor replaces plain textarea
- Send button dynamically shows "Ask Dashboard" (no tags) or "Dispatch to N agents" (with tags)
- Sequential chain execution replaced by parallel dispatch as default mode
- `executeChain()` preserved as deprecated for programmatic API use

### Dependencies
- Added `@anthropic-ai/sdk` (server — dashboard LLM calls)
- Added `lexical`, `@lexical/react`, `@lexical/plain-text` (client — @mention editor)

---

## [1.0.1] - 2026-03-21

### Added
- Agent authentication for memory API endpoints (X-API-Key alongside JWT)
- `requireAuthOrAgent` middleware for dual auth support
- `agent` role in RBAC with task execution permissions
- Python memory client (`multi-claw-agent/src/memory.py`) for shared state and knowledge
- Auto-creation of management API keys when agents are registered, spawned, or docker-spawned
- Auto-generated admin password on first startup when `ADMIN_PASSWORD` is not set
- Improved agent stop/start with port-based process detection fallback

### Fixed
- Memory API endpoints blocked by delegation router middleware ordering
- `hasPermission` return type coerced to boolean
- Dashboard default port changed from 3000 to 3100 to avoid conflicts
- Registration no longer grants first user admin role (admin seeded via `seed-admin`)
- Agent stop button visibility for externally-started agents
- Settings link moved to top-right nav for consistency

### Changed
- Default admin email set to `admin@multiclaw.dev` when not configured
- Documentation updated for admin account seeding and CORS defaults
- Tests directory excluded from git tracking

---

## [1.0.0] - 2026-03-20

### Added

**Core Platform**
- Distributed AI agent management platform with React dashboard and Python agents
- Authentication system with register, login, JWT, and role-based access
- Agent CRUD with health monitoring and real-time status updates
- Task runner with queue management and REST API
- Agent brain with Anthropic SDK integration
- Agent-to-agent message relay through dashboard hub
- SSE streaming for agent status and task updates
- WebSocket support with JWT auth, reconnection, and dual-broadcast (SSE+WS)
- Database schema with users, agents, tasks, skills, and plugins

**Dashboard**
- React frontend with Tailwind CSS, routing, and API client
- Login page with auth hook
- Agent cards with real-time status, spawn UI, and overview controls
- Agent detail page with per-agent Identity tab and system prompt management
- Templates page with CRUD, import/export, and spawn integration
- Workflows page with visual editor (React Flow) and run view
- Delegations page with permissions matrix and history
- Memory page with state browser and knowledge search
- Audit Log admin page with filtering, pagination, and CSV export
- Settings page with Allowed Origins management and Docker sandbox status
- Error boundary, toast hooks, and SSE reconnect

**Agent System**
- Plugin manager with install, load, activate lifecycle
- Plugin REST API with install, activate, deactivate
- Skill manager with install, execute, uninstall
- Skill library with upload and deploy-to-agent
- Plugin library with upload and deploy-to-agent
- Browser Control plugin with Playwright-based automation engine
- 19 agent-facing browser tools (navigation, forms, screenshots, etc.)
- Cron job scheduling with APScheduler integration

**Backend Services**
- Workflow DAG execution engine with conditional expression evaluator
- Docker container agent spawn with lifecycle management (start/stop/logs)
- Docker sandbox runner with resource limits and timeout
- Delegation API with permissions and peer tokens
- Knowledge base API with embedding search
- Shared state key-value API with optimistic concurrency
- Audit logger with admin API routes and CSV export
- Dynamic CORS module with state management

**Infrastructure**
- Interactive installer script for dashboard and agent setup
- Automated dependency checking and installation
- Complete uninstall option
- HTTPS/TLS support for dashboard and agent
- Docker agent base image (Dockerfile.agent)
- Dashboard Dockerfile
- `manage.py` CLI for service management

**Documentation**
- README with technology, provider, and platform badges
- SECURITY.md with comprehensive security documentation
- DOCUMENTATION.md
- In-app Help page
- Roadmap design spec for 10 feature phases

[1.4.0]: https://github.com/a2-stuff/MultiClaw/releases/tag/v1.4.0
[1.3.0]: https://github.com/a2-stuff/MultiClaw/releases/tag/v1.3.0
[1.2.0]: https://github.com/a2-stuff/MultiClaw/releases/tag/v1.2.0
[1.1.0]: https://github.com/a2-stuff/MultiClaw/releases/tag/v1.1.0
[1.0.1]: https://github.com/a2-stuff/MultiClaw/releases/tag/v1.0.1
[1.0.0]: https://github.com/a2-stuff/MultiClaw/releases/tag/v1.0.0
