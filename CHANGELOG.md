# Changelog

All notable changes to MultiClaw will be documented in this file.

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

[1.0.0]: https://github.com/a2-stuff/MultiClaw/releases/tag/v1.0.0
