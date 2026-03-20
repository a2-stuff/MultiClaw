# MultiClaw Documentation

**Version:** 1.0 | **Updated:** March 2026

---

## Table of Contents

1. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Install Wizard Reference](#install-wizard-reference)
   - [First-Time Setup](#first-time-setup)
   - [Creating Your Admin Account](#creating-your-admin-account)
2. [Dashboard Overview](#dashboard-overview)
   - [Navigation](#navigation)
   - [Dashboard Home](#dashboard-home)
   - [Real-Time Updates](#real-time-updates)
3. [Managing Agents](#managing-agents)
   - [Registering a Remote Agent](#registering-a-remote-agent)
   - [Spawning Local Agents](#spawning-local-agents)
   - [Agent Tabs Overview](#agent-tabs-overview)
   - [Overview Tab](#overview-tab)
   - [Tasks Tab](#tasks-tab)
   - [Identity Tab](#identity-tab)
   - [Logs Tab](#logs-tab)
   - [Skills Tab](#skills-tab)
   - [Plugins Tab](#plugins-tab)
   - [Crons Tab](#crons-tab)
   - [Settings Tab](#settings-tab)
   - [Stopping, Starting, and Deleting Agents](#stopping-starting-and-deleting-agents)
4. [Agent Identity](#agent-identity)
5. [Agent Logs](#agent-logs)
6. [Tasks](#tasks)
7. [Skills](#skills)
   - [Skill Providers](#skill-providers)
   - [Installing Skills](#installing-skills)
   - [Deploying Skills to Agents](#deploying-skills-to-agents)
8. [Plugins](#plugins)
9. [Cron Jobs](#cron-jobs)
10. [Templates](#templates)
11. [Workflows](#workflows)
    - [Workflow Definition Format](#workflow-definition-format)
    - [Running Workflows](#running-workflows)
12. [Delegation](#delegation)
    - [Agent Permissions](#agent-permissions)
    - [Delegation History](#delegation-history)
13. [Memory](#memory)
    - [Shared State](#shared-state)
    - [Knowledge Base](#knowledge-base)
14. [Sandbox](#sandbox)
15. [Audit Log](#audit-log)
16. [API Keys](#api-keys)
17. [User Management](#user-management)
18. [Settings](#settings)
19. [CLI Management (manage.py)](#cli-management-managepy)
    - [status](#status)
    - [start / stop / restart](#start--stop--restart)
    - [logs](#logs)
    - [agents](#agents)
    - [restart-agent](#restart-agent)
    - [install](#install)
    - [uninstall](#uninstall)
    - [update](#update)
    - [tui](#tui)
20. [TUI Dashboard](#tui-dashboard)
21. [Environment Variables](#environment-variables)
    - [Dashboard (.env)](#dashboard-env)
    - [Agent (.env)](#agent-env)
22. [TLS / HTTPS Setup](#tls--https-setup)
    - [Using the Installer](#using-the-installer)
    - [Manual Configuration](#manual-configuration)
    - [Certificate Renewal](#certificate-renewal)
    - [Requirements for Certbot](#requirements-for-certbot)
23. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

Before installing MultiClaw, ensure the following software is available on your system:

- **Node.js 18 or later** — required for the dashboard server and frontend build
- **Python 3.11 or later** — required for agents and the management CLI
- **Git** — required for plugin registry cloning and agent code updates
- **npm** — for installing Node.js dependencies

Verify your versions:

```bash
node --version    # should be v18.x or higher
python3 --version # should be 3.11.x or higher
git --version
```

Optional (for specific features):

- **Docker** — required for plugin sandboxing and Docker-managed agents
- **Tailscale** — required for Tailscale secure networking; auto-installed by the installer wizard if chosen
- **certbot** — required for Let's Encrypt TLS certificates; auto-installed by the installer wizard if chosen

### Installation

MultiClaw ships with an interactive install script that handles dependency installation, environment file generation, database initialization, and optional TLS and Tailscale setup.

From the repository root:

```bash
./install.sh
```

The installer first asks whether you are installing the **Dashboard** or an **Agent**:

```
What would you like to install?
  1) Dashboard (control hub)
  2) Agent (lightweight worker)
```

### Install Wizard Reference

#### Dashboard Installation (choice 1)

The dashboard wizard prompts for the following in sequence:

1. **Dashboard port** — default `3000`
2. **JWT Secret** — auto-generates a cryptographically secure 48-byte base64 secret; you may accept it or type your own (must be 32+ characters)
3. **Admin email** — default `admin@multiclaw.dev`
4. **Admin password** — auto-generates a URL-safe random password if left blank; the generated password is displayed and stored in `.env`
5. **CORS allowed origins** — pre-populated with `http://localhost:<port>` and the detected LAN IP; add more as a comma-separated list
6. **AI provider keys** (all optional) — Anthropic, OpenAI, Google/Gemini, OpenRouter, DeepSeek; keys entered here are stored in `.env` and pushed to agents via config sync
7. **Tailscale setup** — optionally installs Tailscale, applies ACL tags, and configures networking mode (`dual-stack` or `tailscale-only`)
8. **TLS/HTTPS setup** — optionally obtains a Let's Encrypt certificate via certbot or accepts paths to existing certificate files

After completion, the wizard prints your admin credentials, the dashboard port, and the command to start the service.

#### Agent Installation (choice 2)

The agent wizard prompts for:

1. **Tailscale setup** — same flow as dashboard; if enabled, the dashboard URL may be auto-discovered
2. **Agent name** — default `Agent-001`
3. **API key** — a `mck_` key from the dashboard Keys page
4. **Dashboard URL** — e.g., `http://192.168.1.10:3000` (skipped if Tailscale auto-discovery is enabled)
5. **Agent port** — default `8100`
6. **Agent URL** — the external URL the dashboard uses to reach this agent (pre-populated from detected IP)
7. **AI provider keys** (all optional) — agent-local keys override dashboard-pushed keys for that provider
8. **Default AI provider and model** — select from Anthropic, OpenAI, Google, OpenRouter, DeepSeek
9. **TLS/HTTPS setup** — same flow as dashboard

### First-Time Setup

After running `./install.sh`, the installer has already generated `multi-claw-dashboard/.env`. Verify the critical values before starting:

```env
PORT=3000
HOST=0.0.0.0
JWT_SECRET=<auto-generated or your value>
CORS_ORIGINS=http://localhost:3000,http://192.168.1.x:3000
ADMIN_EMAIL=admin@multiclaw.dev
ADMIN_PASSWORD=<your password>
```

**JWT_SECRET** must be at least 32 characters. If you need to generate one manually:

```bash
openssl rand -hex 32
```

**CORS_ORIGINS** must include every URL from which you or your browsers will access the dashboard. If you access it over Tailscale or from a remote machine, add those addresses as a comma-separated list.

Once configured, start the services:

```bash
python manage.py install    # sets up systemd and starts both services
# or, to run without systemd:
python manage.py start all
```

### Creating Your Admin Account

Navigate to the dashboard URL in your browser (e.g., `http://localhost:3000`). On first run you will see a login screen pre-seeded with the admin credentials from `.env`. Log in with the email and password set during installation.

The **first user record** in the database is automatically granted the `admin` role. All subsequent registrations default to `viewer`. An admin must promote them if higher access is required.

---

## Dashboard Overview

### Navigation

The sidebar provides access to all major sections of the dashboard:

| Section | Description |
|---------|-------------|
| **Dashboard** | Home view with agent cards, task dispatch, and Tailscale discovery |
| **Agents** | Manage registered and spawned agents with full tabbed detail views |
| **Skills** | Browse, import, and deploy skills to agents |
| **Plugins** | Manage plugins across all agents and the global registry |
| **Crons** | View and manage all scheduled cron jobs across the cluster |
| **Keys** | Create and manage API keys for agent authentication |
| **Users** | Manage user accounts and role assignments (admin only) |
| **Settings** | AI provider keys, CORS origins, Docker sandbox status, and account info |
| **Help** | Documentation and support links |
| **Templates** | Create and manage agent templates with pre-configured settings |
| **Workflows** | Build and run multi-agent workflow chains |
| **Delegations** | Configure agent-to-agent permissions and view delegation history |
| **Memory** | Shared state namespaces and semantic knowledge base |
| **Audit Log** | Complete audit trail of all system actions |

### Dashboard Home

The home view provides a high-level overview of the entire MultiClaw cluster:

- **Task dispatch panel** — Send a task to any available agent directly from the home screen
- **Agent cards** — Each registered agent appears as a card showing name, status, last-seen time, and key metrics
- **Tailscale discovery** — If Tailscale integration is enabled, agents on the same Tailscale network are discovered and displayed automatically before they are manually registered

Agent status indicators on cards update in real time via SSE, giving an at-a-glance view of which agents are online, idle, busy, or unreachable.

### Real-Time Updates

The dashboard uses **Server-Sent Events (SSE)** to push live updates without polling. Agent status changes, task completions, and system metrics are reflected immediately in the browser without a page refresh. The agent overview refreshes on a 15-second interval for system metrics.

---

## Managing Agents

MultiClaw supports two types of agents:

- **Remote agents** — agents running on separate machines, registered by their URL
- **Spawned (local) agents** — agents created and managed directly by the dashboard on the local host

### Registering a Remote Agent

Use this when an agent is already running on another server or VM.

1. Navigate to the **Agents** page and click **+ Add** in the sidebar.
2. Enter a display name and the full URL of the remote agent (e.g., `http://192.168.1.50:8100`).
3. An API key is generated and displayed. **Copy this key immediately** — it is shown only once.
4. On the remote machine, open the agent's `.env` file and set:
   ```env
   MULTICLAW_API_KEY=mck_your_key_here
   MULTICLAW_DASHBOARD_URL=http://your-dashboard-ip:3000
   ```
5. Restart the remote agent. It will authenticate with the dashboard using the key and appear as online.

### Spawning Local Agents

Use this to create a new agent on the same machine as the dashboard.

1. Navigate to the **Agents** page and click **Spawn** in the sidebar.
2. Enter a name for the new agent. You may also select a template to pre-configure the agent's model and system prompt.
3. The dashboard will:
   - Create an isolated directory at `~/.multiclaw/agents/<name>/`
   - Set up a dedicated Python virtual environment inside it
   - Assign an available port starting from `8101` (incrementing for each new agent)
   - Generate a unique API key and write the agent's `.env` automatically
   - Start the agent process in the background

Each spawned agent is fully independent with its own skills directory, plugins directory, and configuration. Agents do not share state with one another.

### Agent Tabs Overview

When an agent is selected in the sidebar, its detail view shows a tabbed interface. The available tabs depend on the user's role:

| Tab | Available to | Description |
|-----|-------------|-------------|
| **Overview** | All | Status, system metrics, quick stats, action buttons |
| **Tasks** | All | Send tasks, view history, delete queued tasks |
| **Identity** | All (edit: admin/operator) | Per-agent system prompt editor |
| **Logs** | All | Real-time log viewer with filtering |
| **Skills** | All | View and manage installed skills |
| **Plugins** | All | View and manage installed plugins |
| **Crons** | admin/operator only | View and manage scheduled jobs |
| **Settings** | admin/operator only | Name, URL, model, API key, config sync status |

### Overview Tab

The Overview tab is the primary view for an agent and displays:

- **Action buttons** — Update Agent Code (git pull), Restart; for spawned agents: Stop Agent / Start Agent; for Docker-managed agents: Stop Container / Start Container / View Logs
- **Spawn Info** — port, PID, host, and directory path (spawned agents only)
- **Container Info** — container ID, image, status, and port (Docker-managed agents only)
- **Quick stats grid** — Status, Last Seen, URL, Model, Skills count, Plugins count, Total Tasks, Tasks (last 24h)
- **Host Overview** — live system info: hostname, OS, architecture, Python version, uptime, load averages; progress bars for CPU, memory, disk; network I/O, TCP connection breakdown, top processes by CPU/memory, open ports list
- **Task Status panel** — active, completed, failed, and queued task counts from the agent's live health data

### Tasks Tab

The Tasks tab provides both task dispatch and task history for the selected agent.

**Sending a task:**
- Type a prompt in the input field and press Enter or click Send
- The task is dispatched to the agent and the history refreshes automatically

**Task history:**
- Displays all tasks in reverse chronological order
- Columns: Prompt, Status, Created By, Created, Completed
- Click any row to expand it and see the full prompt, result, and error details
- Tasks with status `queued` or `running` show a delete button (the `✕` icon) to cancel them

Task statuses: `queued`, `running`, `completed`, `failed`, `cancelled`.

### Identity Tab

See [Agent Identity](#agent-identity) for full details.

### Logs Tab

See [Agent Logs](#agent-logs) for full details.

### Skills Tab

Lists all skills currently installed on this agent. From this tab you can:

- View skill names, versions, and descriptions
- Install new skills using the Add Skill modal (Search Providers, Import from URL, or Upload Custom)
- Remove skills that are no longer needed

### Plugins Tab

Lists all plugins installed on this agent. From this tab you can:

- View plugin names, versions, and their enabled/disabled state
- Enable or disable a plugin without uninstalling it
- Install new plugins from the plugin registry
- Remove plugins

### Crons Tab

Displays all scheduled cron jobs for this agent. See [Cron Jobs](#cron-jobs) for full details. This tab is only visible to users with **admin** or **operator** roles.

### Settings Tab

Provides per-agent configuration controls. Only visible to **admin** and **operator** roles.

- **Agent Name** — rename the agent; saved immediately to the database
- **Agent URL** — update the URL the dashboard uses to reach this agent
- **Model Configuration** — select the default AI provider and model from grouped dropdowns (Anthropic, OpenAI, Gemini, OpenRouter, DeepSeek)
- **API Key** — regenerate the agent's API key; the new key is shown once and the old key is invalidated immediately
- **Config Sync** — indicator showing whether the agent is online and receiving configuration updates; offline agents will receive the sync on next reconnect

### Stopping, Starting, and Deleting Agents

**Spawned agents** show Stop and Start buttons in the Overview tab:

- **Stop Agent** — terminates the process (kills the PID) while preserving the directory and configuration
- **Start Agent** — restarts a previously stopped spawned agent on the same port

**Docker-managed agents** show Stop Container and Start Container buttons instead.

**Restart** — available for all agent types; sends a restart signal to the agent process and polls until it comes back online.

**Delete** — available from the agent header bar (admin/operator only):
- For **remote agents**, removes the database record; the agent process on the remote machine is unaffected.
- For **spawned agents**, terminates the process and **permanently deletes** the entire `~/.multiclaw/agents/<name>/` directory in addition to removing the database record.

---

## Agent Identity

Each agent has an optional **identity** — a system prompt that defines its personality, role, expertise, and behavior. This text is prepended to every task as the system prompt.

**Editing the identity:**

1. Open the **Agents** page and select an agent.
2. Click the **Identity** tab.
3. Type or paste the system prompt in the textarea.
4. Click **Save Identity** to push the change to the agent.

**Uploading from a file:**

Click **Upload .md** to load a Markdown, plain text, or `.markdown` file directly into the editor. The file content replaces the current text.

**Clearing the identity:**

Click **Clear** to empty the field, then **Save Identity** to remove the system prompt from the agent.

The identity is stored in the dashboard database against the agent record and is pushed to the agent via config sync whenever it is saved. The agent uses it for all subsequent tasks until changed. The character and word count are displayed below the editor.

---

## Agent Logs

The **Logs** tab provides a real-time view of the selected agent's log output, fetched directly from the agent's `/logs` endpoint.

**Features:**

- **Text filter** — type to filter displayed log lines by message content (client-side, instant)
- **Level filter** — dropdown to show only DEBUG, INFO, WARNING, or ERROR entries; filtering is applied on the agent side (reduces payload)
- **Auto-refresh** — checkbox toggle; when enabled, fetches new logs every 5 seconds automatically
- **Manual refresh** — click the Refresh button to fetch logs immediately
- **Clear** — deletes all log entries from the agent's in-memory log buffer

**Log levels and colors:**

| Level | Color |
|-------|-------|
| DEBUG | Gray |
| INFO | Blue |
| WARNING | Yellow |
| ERROR | Red |
| CRITICAL | Bold red |

Each log line shows: **time** (HH:MM:SS), **level**, and **message**. Up to 500 entries are fetched per request. If the agent is offline, an error message is shown with a Retry button.

---

## Tasks

Tasks are prompts dispatched to an agent for execution. The agent processes them using its configured AI provider and model, optionally using its installed skills and plugins.

**Sending tasks:**

Tasks can be sent from several places:
- The **Dashboard** home page — dispatch to any online agent
- The **Tasks** tab of a specific agent — dispatches only to that agent
- Via the **API** — `POST /api/agents/:id/tasks` with `{ "prompt": "..." }`

**Task history:**

The Tasks tab shows all tasks for an agent in a table with full status tracking. Clicking a row expands it to show:
- Full prompt text
- Result output (for completed tasks)
- Error message (for failed tasks)

**Deleting tasks:**

Tasks with status `queued` or `running` can be deleted using the `✕` button in the table row. Completed or failed tasks cannot be deleted from the UI.

**Real-time streaming:**

Completed tasks show their result in the expanded row. For long-running tasks, the status updates from `queued` to `running` to `completed` or `failed` as the agent reports progress.

---

## Skills

Skills are modular, self-contained capabilities that agents load and invoke during task execution. Examples include web search, code execution, file operations, and external API integrations.

**Key concepts:**

- Each agent maintains its own skills directory (`MULTICLAW_SKILLS_DIR`, default: `<base_dir>/skills/`)
- Skills are `.md` files that define the skill's behavior and instructions for the AI model
- The global **Skills** page shows all skills recorded in the dashboard database
- Skills are independent of one another and of the agent core

### Skill Providers

Skills can be sourced from multiple providers:

| Provider | Description |
|----------|-------------|
| **ClawHub** | The primary MultiClaw skill registry — search and install community skills |
| **SkillSSH** | The skills.sh registry — search by name, downloads SKILL.md files from GitHub repositories |
| **Import from URL** | Paste a direct URL to a skill package (ClawHub or skills.sh format) |
| **Upload Custom** | Upload a `.md` skill file directly from your machine |

The **SkillSSH** provider searches `skills.sh/api/search`, retrieves results including install counts and source repository, then fetches the SKILL.md from GitHub and packages it as a zip for the agent.

### Installing Skills

**From the Skills page:**

1. Click **Add Skill** to open the modal.
2. Choose a tab: **Search Providers**, **Import from URL**, or **Upload Custom**.
3. For Search Providers: type a query and press Enter or click Search. Results from all configured providers are shown together with their provider label and description. Click **Add** on a result to import it.
4. For Import from URL: paste a URL and click Import.
5. For Upload Custom: enter a name and description, select a `.md` file, and click Upload.

**From an agent's Skills tab:**

The same Add Skill modal is available. After import the skill is recorded in the dashboard and available for deployment.

### Deploying Skills to Agents

After a skill is imported into the dashboard, it must be deployed to individual agents. From an agent's Skills tab, install a skill to push its files into the agent's skills directory. The agent loads skills on startup; a restart may be required for newly installed skills to take effect.

---

## Plugins

Plugins extend an agent's core functionality with integrations such as Docker management, Portainer, Tailscale networking, and custom tooling.

**Key concepts:**

- Plugins are **Git-based** — each plugin is a GitHub repository cloned into the agent's plugins directory
- **Post-install scripts** run automatically after cloning to handle setup (e.g., `pip install -r requirements.txt`)
- Plugins can be **enabled or disabled** per agent without uninstalling
- The dashboard maintains a central **plugin registry** seeded with default plugins at startup
- Admins can add new plugins to the registry by providing a GitHub repository URL

**Available plugins:**

| Plugin | Description | Key Features |
|--------|-------------|--------------|
| **Browser Control** | Browser automation via Playwright | Navigate pages, fill forms, click elements, take screenshots, extract text/HTML, manage tabs, handle cookies, emulate devices. 19 agent-facing tools. Supports Chromium, Firefox, and WebKit. Configurable viewport, user agent, URL allowlists/blocklists, and JavaScript execution policy. |
| **Docker** | Install and manage Docker containers on the agent host | Pull images, create/start/stop/remove containers, inspect container state, list containers and images, manage volumes and networks. |
| **Portainer** | Install Portainer CE Docker management UI | Automated Portainer CE installation and setup, providing a web-based GUI for Docker container management on the agent host. |
| **Tailscale** | Tailscale VPN mesh networking | Secure zero-config networking between agents and dashboard. Automatic peer discovery, ACL tag management, and support for dual-stack or Tailscale-only networking modes. |
| **Hello Plugin** | Minimal example / template plugin | Demonstrates the plugin interface (entry point, plugin.json structure, tool registration). Use as a starting point for building custom plugins. |

**Installing a plugin on an agent:**

1. Open the agent's **Plugins** tab.
2. Click **Install from Registry**.
3. Select the desired plugin from the list.
4. The dashboard clones the repository into the agent's plugins directory and runs any post-install scripts.

**Enabling and disabling:**

Toggle the enabled state from the Plugins tab. Disabled plugins remain installed but are not loaded by the agent.

---

## Cron Jobs

Cron jobs schedule recurring commands on any agent using standard five-field cron expressions.

**Creating a cron job:**

1. Navigate to an agent's **Crons** tab (or the global **Crons** page).
2. Click **Add Cron**.
3. Enter a cron expression, the command to run, and an optional description.

**Cron expression examples:**

| Expression | Meaning |
|------------|---------|
| `*/10 * * * *` | Every 10 minutes |
| `0 * * * *` | Every hour |
| `0 9 * * 1-5` | Every weekday at 09:00 |
| `0 0 * * *` | Every day at midnight |
| `30 2 * * 0` | Every Sunday at 02:30 |

**Run history:**

Each cron execution is logged with:
- Start time and duration
- Exit code (0 = success, non-zero = failure)
- Standard output and error output

**Managing crons:**

- Toggle individual cron jobs on or off without deleting them
- Cron state is persisted in each agent's local `crons.json` file
- Changes made from the dashboard are synced to the agent automatically
- The global Crons page shows crons across all agents in one view

Only users with **admin** or **operator** roles can create, modify, or delete cron jobs.

---

## Templates

Agent templates save a pre-configured agent specification that can be reused when spawning new agents. Templates are managed from the **Templates** page.

**Template fields:**

| Field | Description |
|-------|-------------|
| **Name** | Required display name for the template |
| **Description** | Optional description of what the template is for |
| **Provider** | Default AI provider (Anthropic, OpenAI, Google, OpenRouter, DeepSeek, or default) |
| **Model** | Default model identifier (e.g., `claude-sonnet-4-6`) |
| **System Prompt** | Pre-filled identity / system prompt applied to agents spawned from this template |

**Actions:**

- **New Template** — opens the creation form (admin/operator only)
- **Edit** — modify an existing template
- **Spawn** — navigates to the Agents page with the spawn modal pre-filled from this template
- **Export** — downloads the template as a `.json` file
- **Import** — imports a previously exported `.json` template file
- **Delete** — removes the template (does not affect agents already spawned from it)

Templates are visible to all users but can only be created, edited, or deleted by admin and operator roles.

---

## Workflows

Workflows orchestrate sequences of tasks across multiple agents in a defined order. A workflow consists of named **steps**, each assigned to a specific agent with a prompt and optional links to subsequent steps.

**Workflow lifecycle:**

A workflow has one of three statuses:
- **Draft** — being designed, cannot be run
- **Active** — available to run
- **Archived** — retired; remains visible in history

### Workflow Definition Format

Workflows are defined as JSON. The top-level object requires a `steps` key whose value is an object where each key is a step name:

```json
{
  "steps": {
    "step1": {
      "agentId": "uuid-of-target-agent",
      "prompt": "Summarize the following data: {{input}}",
      "next": ["step2"]
    },
    "step2": {
      "agentId": "uuid-of-another-agent",
      "prompt": "Review the summary and extract action items.",
      "next": [],
      "condition": "step1.output.length > 100"
    }
  }
}
```

**Step fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `agentId` | Yes | UUID of the agent that will execute this step |
| `prompt` | Yes | Task prompt sent to the agent |
| `next` | No | Array of step names to execute after this step completes |
| `condition` | No | Expression that must evaluate to true for this step to run |

The editor shows an **Available Agents** panel listing all registered agents with copyable IDs, and a **Step Overview** preview that validates the JSON and visualizes the step graph in real time.

### Running Workflows

1. Open a workflow and click **Run Workflow** (or click **Run** from the workflow list).
2. Optionally provide a JSON input object.
3. The dashboard starts the run and polls for updates every 2 seconds.
4. The **Run view** shows:
   - Run details (ID, start time, completion time)
   - Per-step status indicators with expandable input/output panels
   - A **Cancel Run** button if the run is still in progress
   - Final output when complete

Step statuses: `pending`, `running`, `completed`, `failed`, `skipped`.

---

## Delegation

The **Delegations** page manages agent-to-agent task delegation — the ability for one agent to assign tasks to another and query its results.

### Agent Permissions

Before an agent can delegate to another, a permission record must exist. Permissions are created from the **Agent Permissions** section:

1. Click **Add Permission**.
2. Select the **From Agent** (the agent that will initiate delegation).
3. Select the **To Agent** (the agent that will receive delegated tasks).
4. Configure the permission flags:
   - **Can Delegate** — allows the from-agent to dispatch tasks to the to-agent
   - **Can Query** — allows the from-agent to read the to-agent's task results
5. Click **Create**.

Permissions can be deleted but not edited; create a new permission to change flags.

### Delegation History

The **Delegation History** section displays a log of all delegation events, including:

- From/To agent names
- Mode (the delegation mode used)
- Status (pending, running, completed, failed)
- Created and completed timestamps

---

## Memory

The **Memory** page provides two types of shared state accessible to all agents: a key-value **State** store and a semantic **Knowledge** base.

### Shared State

The State tab manages namespaced key-value pairs. Each entry is versioned and supports optional expiry.

**Namespaces:**

State is organized into namespaces (default: `default`). Enter a namespace name and click Refresh to load its entries. Multiple namespaces can exist independently.

**Setting a value:**

1. Enter a key name, a JSON value (e.g., `"hello"`, `42`, `{"a": 1}`), and an optional ISO expiry timestamp.
2. Click **Set**.

**Viewing and editing a value:**

Click a key in the left panel to load its value in the right editor. Modify the JSON and click **Update** to save with automatic version increment. Version numbers are displayed next to each key.

**Expiry:**

Keys with an expiry timestamp show an "expires" label. They are automatically removed after the expiry time passes.

**Deleting:**

Click **Delete** next to a key to remove it immediately.

### Knowledge Base

The Knowledge tab manages a semantic knowledge base with vector embeddings for similarity search.

**Semantic search:**

Type a natural language query and click **Search** (or press Enter) to find the most relevant entries by semantic similarity. Results show a similarity percentage (0–100%) next to each entry. Click **Clear** to dismiss search results and return to the full list.

**Ingesting knowledge:**

1. Enter content text in the textarea.
2. Optionally add a metadata JSON object (e.g., `{"source": "docs", "topic": "api"}`).
3. Click **Ingest**.

Entries with embeddings show a green "yes" badge in the Embedding column; entries without embeddings cannot be semantically searched.

**Browsing entries:**

All entries are listed in a table showing truncated content, metadata, embedding status, and creation time. Entries are paginated at 50 per page.

---

## Sandbox

MultiClaw supports sandboxed execution of plugins and agent tasks via Docker. The sandbox status is visible on the **Settings** page under **Docker Sandbox**.

**When Docker is available:**

- Docker version, container count, and image count are displayed
- Plugins with a post-install Docker configuration run in isolated containers
- Docker-managed agents can be spawned as containers and controlled (start/stop) from the agent's Overview tab

**When Docker is unavailable:**

Plugin sandboxing is disabled. Plugins run in the agent's host environment. The Settings page shows a "Docker Unavailable" indicator in red.

To enable sandboxing, install Docker on the dashboard host and ensure the service user has permission to access the Docker socket.

---

## Audit Log

The **Audit Log** page provides a complete, immutable trail of all actions taken in the system.

**Tracked action categories:**

| Category | Actions |
|----------|---------|
| Agents | create, spawn, stop, start, delete, update |
| Tasks | create, cancel, complete |
| Skills | install, remove |
| Plugins | install, enable, disable, remove |
| Settings | update, delete |
| Users | login, create, update, delete |
| Keys | create, revoke, delete |

**Each log entry records:**

- **Timestamp** — exact date and time of the action
- **Actor** — actor type (user or agent) and a truncated actor ID
- **Action** — dot-notation action identifier (e.g., `agent.spawn`, `settings.update`)
- **Target** — target type and truncated target ID (e.g., `agent:abc12345`)
- **IP Address** — originating IP of the request

**Filtering:**

Use the dropdown to filter by a specific action. The total entry count is displayed next to the filter.

**Export:**

Click **Export CSV** to download all audit log entries as a CSV file named `audit-logs-YYYY-MM-DD.csv`.

Entries are paginated at 50 per page.

---

## API Keys

API keys authenticate agents when they connect to the dashboard. Keys are managed from the **Keys** page.

**Key prefixes:**

| Prefix | Description |
|--------|-------------|
| `mck_` | Manually created keys — created from the Keys page by a user |
| `mca_` | Auto-generated keys — created automatically when spawning a local agent |

**Security model:**

- The raw key value is shown **only once** at creation time — copy it immediately
- Only a SHA-256 hash of the key is stored in the database
- Keys can be revoked at any time from the Keys page; revoked keys are rejected immediately
- Key regeneration from an agent's Settings tab creates a new `mca_` key and invalidates the old one

**Usage:**

An agent authenticates with the dashboard by including its API key in the connection request. Set the key in the agent's environment:

```env
MULTICLAW_API_KEY=mck_your_key_here
```

---

## User Management

MultiClaw uses role-based access control with three roles:

| Role | Permissions |
|------|-------------|
| **admin** | Full access — manage users, agents, settings, plugins, crons, keys, audit log |
| **operator** | Manage agents, skills, plugins, crons, workflows, templates; cannot manage users or global settings |
| **viewer** | Read-only access to agents and tasks; cannot make configuration changes |

**Viewer restrictions:**

- Crons and Settings tabs are hidden on agent detail views
- Cannot create, edit, or delete templates, workflows, or permissions
- Can view but not edit agent identity

**First user:**

The first account registered on a fresh installation is automatically assigned the `admin` role. All subsequent registrations default to `viewer`.

**Managing users:**

Admins can view all registered users and change their roles from the **Users** page. Users cannot change their own role.

---

## Settings

The **Settings** page controls dashboard-wide configuration.

### Allowed Origins (CORS)

Lists all origins permitted to make requests to the dashboard API:

- **Protected origins** — loaded from the `CORS_ORIGINS` environment variable; cannot be removed from the UI
- **Custom origins** — added through the Settings page; can be removed individually

To add an origin: type the full URL (e.g., `https://192.168.1.50:8000`) and click **Add** or press Enter. To remove a custom origin, click the **×** next to it.

Changes take effect immediately without a restart.

### AI Provider API Keys

Keys entered here are stored in the database and pushed to all connected agents via config sync. Agents with a local key in their `.env` use their own key instead of the dashboard-pushed key for that provider.

Supported providers:

| Provider | Key placeholder |
|----------|----------------|
| Anthropic | `sk-ant-...` |
| OpenAI | `sk-...` |
| Google Gemini | `AIza...` |
| OpenRouter | `sk-or-...` |
| DeepSeek | `sk-...` |

The stored value is displayed masked (e.g., `••••••abcdef`) after saving. Click **Save** next to a provider to update its key and push to all agents immediately.

### Docker Sandbox

Displays Docker availability, server version, container count, and image count. Shows an error state if Docker is not accessible.

### Account

Displays the current user's name, email, and role. Roles cannot be changed from this page.

### System

Displays the MultiClaw version.

---

## CLI Management (manage.py)

The `manage.py` script in the repository root provides full lifecycle management of MultiClaw services from the command line. It requires the management dependencies (`click`, `httpx`, `psutil`, `rich`) — these are installed when you run `pip install -e .` in the repo root or when the agent venv is set up.

```bash
python manage.py --help
python manage.py --version
```

### status

```bash
python manage.py status
```

Displays a rich formatted table of service health for both the dashboard and the primary agent:

- **Service** — name (Dashboard / Agent)
- **State** — online (green), failed (red), stopped (dim)
- **PID** — process ID if running
- **Uptime** — formatted as `Xd Yh Zm`
- **CPU** — current CPU percentage
- **Memory** — resident set size (KB/MB/GB)

Below the table, a dashboard panel shows registered vs. online agent counts and database size, and an agent panel shows task counts, loaded skills/plugins/crons, and version.

### start / stop / restart

```bash
# Target a specific service or all
python manage.py start dashboard
python manage.py start agent
python manage.py start all

python manage.py stop dashboard
python manage.py stop agent
python manage.py stop all

python manage.py restart dashboard
python manage.py restart agent
python manage.py restart all
```

These commands use `sudo systemctl` to control the `multiclaw-dashboard` and `multiclaw-agent` systemd units. After a start or restart, a 2-second pause is followed by a status display.

### logs

```bash
# Show last 50 lines (default)
python manage.py logs dashboard
python manage.py logs agent

# Show a specific number of lines
python manage.py logs dashboard -n 100
python manage.py logs agent -n 200

# Follow logs in real time (Ctrl+C to exit)
python manage.py logs dashboard -f
python manage.py logs agent --follow
```

Reads from `journalctl` for the respective systemd unit. Note: `logs` accepts `dashboard` or `agent` only, not `all` — open two terminals to follow both simultaneously.

### agents

```bash
python manage.py agents
```

Reads the dashboard SQLite database directly and displays a table of all registered agents with:

- Name, URL, state (online/error/offline)
- PID (spawned agents)
- Port (spawned agents)
- Host (`local` for spawned, `remote` for registered-only)

### restart-agent

```bash
python manage.py restart-agent <agent-name>
```

Restarts a specific spawned agent by name. The command:
1. Looks up the agent in the database to get its PID, port, and directory
2. Sends SIGTERM to the current process (waits 2 seconds)
3. Starts a new `uvicorn` process in the agent's directory using its `.venv`
4. Updates the PID in the database and writes it to `.pid`
5. Polls `/health` to confirm the agent is responsive

### install

```bash
# Interactive (prompts for confirmation and whether to start)
python manage.py install

# Non-interactive (overwrites existing units and starts immediately)
python manage.py install -y
```

Generates and installs systemd unit files for both `multiclaw-dashboard` and `multiclaw-agent`:

- Detects the current user and paths to `node` and the agent `.venv`
- Writes unit files to `/etc/systemd/system/` via `sudo tee`
- Runs `systemctl daemon-reload` and enables both units
- Optionally starts both services immediately

The generated dashboard unit runs: `node --import tsx server/index.ts`
The generated agent unit runs: `uvicorn src.main:app --host 0.0.0.0`

### uninstall

```bash
# Interactive
python manage.py uninstall

# Non-interactive
python manage.py uninstall -y
```

Stops and disables both services, removes the unit files from `/etc/systemd/system/`, and reloads the systemd daemon. Data directories and `.env` files are not removed.

### update

```bash
python manage.py update
```

Pulls the latest code and rebuilds everything in sequence:

1. Checks for uncommitted changes (aborts with an error if found)
2. Stops any currently-running services
3. Runs `git pull origin main`
4. Runs `npm install` for the dashboard and client
5. Runs `npm run build` for the React client
6. Runs `pip install -e .` for the agent
7. Runs database migrations (`npx tsx server/db/migrate.ts`)
8. Restarts any services that were running before the update
9. Displays the final status

If any step fails, the process aborts with an error message indicating which step failed.

### tui

```bash
python manage.py tui
# or directly:
python tui.py
```

Launches the interactive terminal dashboard. See [TUI Dashboard](#tui-dashboard) for details.

---

## TUI Dashboard

The TUI (Terminal User Interface) is an alternative to the web dashboard for managing MultiClaw from a terminal. It is especially useful for SSH sessions or environments where a browser is unavailable.

**Launch:**

```bash
python manage.py tui
# or directly:
python tui.py
```

**Features:**

- Real-time service status for the dashboard and primary agent (state, PID, uptime, CPU, memory)
- Agent health indicators and resource usage (tasks completed/active/failed, skills, plugins, crons)
- DB size and registered/online agent counts
- Keyboard shortcuts for common operations:
  - `s` — start all services
  - `S` — stop all services
  - `r` — restart all services
  - `R` — restart dashboard only
  - `a` — restart agent only
  - `q` or `Q` — quit the TUI
- Log pane showing recent log output from managed services
- Automatic refresh every 0.5 seconds
- No browser required — fully functional over SSH

The TUI is built with [Rich](https://github.com/Textualize/rich) and uses raw terminal mode for keyboard input.

---

## Environment Variables

### Dashboard (.env)

Located at `multi-claw-dashboard/.env`.

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port the dashboard server listens on | `3000` |
| `HOST` | Bind address for the server | `0.0.0.0` |
| `JWT_SECRET` | Secret used to sign JWT auth tokens — must be 32+ characters | *(required)* |
| `JWT_EXPIRES_IN` | Token expiry duration | `24h` |
| `DB_PATH` | Path to the SQLite database file | `./data/multiclaw.db` |
| `CORS_ORIGINS` | Comma-separated list of allowed request origins | `http://localhost:5173` |
| `ADMIN_EMAIL` | Email address for the auto-seeded admin account | — |
| `ADMIN_PASSWORD` | Password for the auto-seeded admin account | — |
| `ANTHROPIC_API_KEY` | Anthropic API key (synced to agents) | — |
| `OPENAI_API_KEY` | OpenAI API key (synced to agents) | — |
| `GOOGLE_API_KEY` | Google API key for Gemini (synced to agents) | — |
| `OPENROUTER_API_KEY` | OpenRouter API key (synced to agents) | — |
| `DEEPSEEK_API_KEY` | DeepSeek API key (synced to agents) | — |
| `TLS_CERT` | Path to TLS certificate file for HTTPS | — |
| `TLS_KEY` | Path to TLS private key file | — |
| `MULTICLAW_TAILSCALE_ENABLED` | Enable Tailscale integration | `false` |
| `MULTICLAW_TAILSCALE_MODE` | Tailscale networking mode: `dual-stack` or `tailscale-only` | `dual-stack` |
| `MULTICLAW_TAILSCALE_TAG` | ACL tag applied to the dashboard in Tailscale | `tag:multiclaw-dashboard` |

### Agent (.env)

Located at `multi-claw-agent/.env` (or inside a spawned agent's directory at `~/.multiclaw/agents/<name>/.env`).

| Variable | Description | Default |
|----------|-------------|---------|
| `MULTICLAW_AGENT_NAME` | Display name shown in the dashboard | `MultiClaw Agent` |
| `MULTICLAW_AGENT_ID` | Agent UUID — set automatically after first connect | — |
| `MULTICLAW_AGENT_URL` | External URL the dashboard uses to reach this agent | — |
| `MULTICLAW_PORT` | Port the agent HTTP server listens on | `8100` |
| `MULTICLAW_HOST` | Bind address for the agent | `0.0.0.0` |
| `MULTICLAW_API_KEY` | `mck_` or `mca_` key from the dashboard Keys page | *(required)* |
| `MULTICLAW_AGENT_SECRET` | Legacy secret field (superseded by `MULTICLAW_API_KEY`) | — |
| `MULTICLAW_DASHBOARD_URL` | Full URL of the MultiClaw dashboard | *(required)* |
| `MULTICLAW_AUTO_REGISTER` | Automatically connect to the dashboard on startup | `true` |
| `MULTICLAW_DEFAULT_PROVIDER` | Default AI provider (`anthropic`, `openai`, `gemini`, `openrouter`, `deepseek`) | `anthropic` |
| `MULTICLAW_DEFAULT_MODEL` | Default model identifier | `claude-sonnet-4-6` |
| `MULTICLAW_MAX_TOKENS` | Maximum token budget per task | `4096` |
| `MULTICLAW_BASE_DIR` | Base directory for agent data | *(repo directory)* |
| `MULTICLAW_SKILLS_DIR` | Directory where skills are stored | `<base_dir>/skills` |
| `MULTICLAW_PLUGINS_DIR` | Directory where plugins are stored | `<base_dir>/plugins` |
| `MULTICLAW_ANTHROPIC_API_KEY` | Anthropic API key (agent-local; overrides dashboard key) | — |
| `MULTICLAW_OPENAI_API_KEY` | OpenAI API key (agent-local; overrides dashboard key) | — |
| `MULTICLAW_GOOGLE_API_KEY` | Google API key for Gemini (agent-local; overrides dashboard key) | — |
| `MULTICLAW_OPENROUTER_API_KEY` | OpenRouter API key (agent-local; overrides dashboard key) | — |
| `MULTICLAW_DEEPSEEK_API_KEY` | DeepSeek API key (agent-local; overrides dashboard key) | — |
| `MULTICLAW_TLS_CERT` | Path to TLS certificate file for HTTPS | — |
| `MULTICLAW_TLS_KEY` | Path to TLS private key file | — |
| `MULTICLAW_TAILSCALE_ENABLED` | Enable Tailscale integration | `false` |
| `MULTICLAW_TAILSCALE_MODE` | Tailscale networking mode: `dual-stack` or `tailscale-only` | `dual-stack` |
| `MULTICLAW_TAILSCALE_TAG` | ACL tag applied to the agent in Tailscale | `tag:multiclaw-agent` |
| `MULTICLAW_TAILSCALE_DASHBOARD_PORT` | Dashboard port for Tailscale discovery | `3000` |
| `MULTICLAW_CORS_ORIGINS` | Comma-separated allowed origins for the agent's own CORS policy | *(dashboard URL only)* |

---

## TLS / HTTPS Setup

MultiClaw supports TLS encryption for both the dashboard and agents. The `install.sh` wizard includes an optional TLS setup step during installation.

### Using the Installer

During installation, the TLS wizard asks:

1. **"Set up TLS/HTTPS with Let's Encrypt (certbot)?"**
   - **No** — skip TLS; configure it later manually in `.env`
   - **Yes** — continue to certificate selection

2. **"Do you already have TLS certificates?"**
   - **Yes** — enter the paths to your `fullchain.pem` and `privkey.pem` files; the installer validates that the files exist and writes the paths to `.env`
   - **No** — run the certbot flow below

3. **Certbot flow:**
   - Installs certbot automatically if not present (using `apt-get`, `dnf`, `pacman`, or `snap` depending on the system)
   - Prompts for your domain name (e.g., `multiclaw.example.com`) and a Let's Encrypt notification email
   - Runs `certbot certonly --standalone -d <domain>` (port 80 must be free and accessible)
   - Writes `TLS_CERT` and `TLS_KEY` paths to `.env`
   - Optionally sets up auto-renewal (a cron job at 3 AM daily with a post-hook to restart the service)
   - Grants read access to the certificate files for the current user

### Manual Configuration

**Dashboard (`multi-claw-dashboard/.env`):**

```env
TLS_CERT=/etc/letsencrypt/live/your-domain/fullchain.pem
TLS_KEY=/etc/letsencrypt/live/your-domain/privkey.pem
```

**Agent (`.env` or `~/.multiclaw/agents/<name>/.env`):**

```env
MULTICLAW_TLS_CERT=/etc/letsencrypt/live/your-domain/fullchain.pem
MULTICLAW_TLS_KEY=/etc/letsencrypt/live/your-domain/privkey.pem
```

**Starting the agent with TLS manually:**

```bash
source .venv/bin/activate
uvicorn src.main:app --host 0.0.0.0 --port 8100 \
  --ssl-certfile /etc/letsencrypt/live/your-domain/fullchain.pem \
  --ssl-keyfile /etc/letsencrypt/live/your-domain/privkey.pem
```

### Certificate Renewal

Let's Encrypt certificates expire after 90 days. If you used certbot, auto-renewal should be configured. To verify and manage manually:

```bash
# Check certificate status
sudo certbot certificates

# Manual renewal (run before expiry)
sudo certbot renew

# Auto-renewal cron set up by the installer (runs daily at 3 AM):
# 0 3 * * * certbot renew --quiet --post-hook "systemctl restart multiclaw-dashboard 2>/dev/null || true"
```

### Requirements for Certbot

- A domain name (e.g., `multiclaw.example.com`) with a DNS A record pointing to your server's public IP
- Port 80 must be accessible from the internet and not in use by another service at the time of certificate issuance
- An email address for Let's Encrypt expiry notifications

---

## Troubleshooting

### Agent shows "error" status

1. Verify the agent is running and responding: `curl http://<agent-ip>:<port>/health`
2. Check that `MULTICLAW_API_KEY` in the agent's `.env` matches a valid key on the dashboard Keys page
3. Review the agent's log output from the Logs tab in the dashboard, or run: `python manage.py logs agent -n 100`
4. Confirm there are no firewall rules blocking the agent port

### CORS errors in the browser

The dashboard is rejecting requests from your browser's origin.

1. Open **Settings** in the dashboard and add your access URL to **Allowed Origins**
2. Alternatively, edit `multi-claw-dashboard/.env` and add the URL to `CORS_ORIGINS` (comma-separated)
3. If you edited `.env` directly, restart the dashboard: `python manage.py restart dashboard`

### Blank page after login or update

Stale cached assets with outdated CSP headers can cause this.

1. Hard refresh: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (macOS)
2. If that does not help, clear the browser cache for the dashboard domain

### Agent will not connect to the dashboard

Work through these checks in order:

1. Confirm `MULTICLAW_DASHBOARD_URL` in the agent `.env` is correct and reachable from the agent host: `curl <MULTICLAW_DASHBOARD_URL>/health`
2. Confirm `MULTICLAW_API_KEY` is set to a valid key from the dashboard **Keys** page
3. Confirm the key has not been revoked
4. Check for firewall rules blocking the dashboard port
5. Review agent startup logs for the specific error message

### Spawn fails when creating a local agent

1. Confirm `python3` is available in the system `PATH`: `which python3`
2. Confirm Python version is 3.11 or higher: `python3 --version`
3. Ensure the directory `~/.multiclaw/agents/` is writable by the user running the dashboard
4. Check the dashboard logs for the specific error: `python manage.py logs dashboard -n 50`

### Port conflict on agent startup

Spawned agents are assigned ports starting from `8101`. If a port is already in use:

1. Check which process is using the port: `ss -tlnp | grep <port>`
2. Either stop the conflicting process or edit the spawned agent's `.env` directly to change `MULTICLAW_PORT`, then restart the agent from the Overview tab

### manage.py commands fail with "node not found" or "venv not found"

These errors occur if you have not run `./install.sh` yet, or if the installation was incomplete.

1. Run `./install.sh` to complete the installation
2. Verify `node` is in `PATH`: `which node`
3. Verify the agent venv exists: `ls multi-claw-agent/.venv/bin/python`

### TLS/HTTPS not working

- Verify certificate files exist and are readable by the service user: `ls -la /etc/letsencrypt/live/your-domain/`
- Check that `TLS_CERT` and `TLS_KEY` paths in `.env` are correct
- Ensure port 443 is not blocked by the firewall
- For certbot issues: `sudo certbot certificates` shows certificate status and expiry
- Verify the service user has read access to the private key file (the installer sets this with `chmod 0640` and `chgrp`)

### Skills or plugins not loading after installation

- Skills are loaded by the agent at startup; restart the agent after installing new skills
- Plugins with post-install scripts may have failed silently — check the Plugins tab for error indicators and review agent logs
- Confirm the skills/plugins directories are correctly set: check `MULTICLAW_SKILLS_DIR` and `MULTICLAW_PLUGINS_DIR` in the agent's `.env`

### Workflow steps not executing

- Verify that all `agentId` values in the workflow definition are valid UUIDs of registered agents
- Ensure the referenced agents are online (check the Overview tab)
- Confirm the workflow status is **Active** — Draft workflows cannot be run
- Check the run view's step output for specific error messages from each step
