import { v4 as uuid } from "uuid";
import { db } from "./index.js";
import { pluginRegistry, skillProviders } from "./schema.js";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Plugin manifests — declares env vars, deps, post-install, health checks
// ---------------------------------------------------------------------------

const manifests: Record<string, object> = {
  superpowers: {
    envVars: [],
    dependencies: [],
    systemRequirements: [],
    postInstallSteps: [
      { id: "copy-skills", label: "Copy skills to agent", type: "copy-skills", timeout: 60 },
      { id: "verify-skills", label: "Verify skill files", type: "command", command: "ls -la ~/.claude/skills/ | head -20", timeout: 15 },
    ],
    healthChecks: [
      { type: "file-exists", filePath: "~/.claude/skills", description: "Skills directory exists" },
    ],
  },

  shannon: {
    envVars: [
      { name: "ANTHROPIC_API_KEY", description: "Anthropic API key for Shannon's LLM calls", required: true, secret: true },
      { name: "CLAUDE_CODE_MAX_OUTPUT_TOKENS", description: "Max output tokens (recommended: 64000)", required: false, secret: false, defaultValue: "64000" },
    ],
    dependencies: [],
    systemRequirements: ["docker", "nodejs"],
    postInstallSteps: [
      { id: "verify-docker", label: "Verify Docker is running", type: "command", command: "docker info > /dev/null 2>&1", timeout: 15 },
      { id: "verify-node", label: "Verify Node.js available", type: "command", command: "node --version", timeout: 10 },
      { id: "test-shannon", label: "Test Shannon CLI", type: "command", command: "npx @keygraph/shannon --help 2>/dev/null || echo 'Shannon CLI check skipped'", timeout: 60 },
    ],
    healthChecks: [
      { type: "command", command: "docker info > /dev/null 2>&1 && echo 'Docker OK'", description: "Docker daemon running" },
      { type: "command", command: "test -n \"$ANTHROPIC_API_KEY\" && echo 'API key set'", description: "Anthropic API key configured" },
    ],
  },

  "agentpay-sdk": {
    envVars: [
      { name: "AGENTPAY_NETWORK", description: "Chain ID (e.g. 11155111 for Sepolia)", required: true, secret: false, defaultValue: "11155111" },
      { name: "AGENTPAY_RPC_URL", description: "Ethereum RPC endpoint URL", required: true, secret: false },
      { name: "AGENTPAY_CHAIN_NAME", description: "Human-readable chain name", required: false, secret: false, defaultValue: "sepolia" },
      { name: "AGENTPAY_PER_TX_MAX_WEI", description: "Max wei per transaction (spending policy)", required: false, secret: false },
      { name: "AGENTPAY_DAILY_MAX_WEI", description: "Max wei per day (spending policy)", required: false, secret: false },
    ],
    dependencies: [],
    systemRequirements: ["nodejs", "pnpm"],
    postInstallSteps: [
      { id: "install-deps", label: "Install dependencies", type: "command", command: "pnpm install", timeout: 300 },
      { id: "build", label: "Build SDK", type: "command", command: "pnpm run build", timeout: 300 },
      { id: "install-cli", label: "Install CLI launcher", type: "command", command: "pnpm run install:cli-launcher 2>/dev/null || echo 'CLI launcher install skipped'", timeout: 120 },
      { id: "setup-wallet", label: "Setup wallet (auto-generates keys)", type: "command", command: "agentpay admin setup --network $AGENTPAY_NETWORK --rpc-url $AGENTPAY_RPC_URL 2>/dev/null || echo 'Wallet setup requires manual intervention'", timeout: 120 },
    ],
    healthChecks: [
      { type: "command", command: "agentpay admin status 2>/dev/null || echo 'AgentPay daemon not running'", description: "AgentPay daemon responsive" },
    ],
  },

  "agentpay-skill-pack": {
    envVars: [],
    dependencies: [
      { slug: "agentpay-sdk", reason: "Skills require AgentPay SDK daemon to be installed and running" },
    ],
    systemRequirements: [],
    postInstallSteps: [
      { id: "verify-sdk", label: "Verify AgentPay SDK installed", type: "command", command: "agentpay admin status 2>/dev/null || echo 'WARNING: AgentPay SDK not detected'", timeout: 15 },
      { id: "copy-skills", label: "Copy payment skills to agent", type: "copy-skills", timeout: 60 },
    ],
    healthChecks: [
      { type: "command", command: "agentpay admin status 2>/dev/null && echo 'SDK OK'", description: "AgentPay SDK daemon reachable" },
      { type: "file-exists", filePath: "~/.claude/skills", description: "Skills directory exists" },
    ],
  },

  "bankr-agent": {
    envVars: [
      { name: "BANKR_API_KEY", description: "Bankr API key (starts with bk_...)", required: true, secret: true, validationRegex: "^bk_", autoGenerate: "bankr-login" },
      { name: "BANKR_LLM_KEY", description: "Optional LLM gateway key for Bankr", required: false, secret: true },
    ],
    dependencies: [],
    systemRequirements: ["nodejs", "npm"],
    postInstallSteps: [
      { id: "install-cli", label: "Install @bankr/cli globally", type: "command", command: "npm install -g @bankr/cli", timeout: 120 },
      { id: "verify-cli", label: "Verify bankr CLI", type: "command", command: "bankr --version", timeout: 15 },
      { id: "configure-key", label: "Configure API key", type: "command", command: "bankr login --api-key $BANKR_API_KEY 2>/dev/null || echo 'API key configuration requires manual login'", timeout: 30 },
    ],
    healthChecks: [
      { type: "command", command: "bankr whoami 2>/dev/null", description: "Bankr CLI authenticated and responsive" },
    ],
  },

  "browser-control": {
    envVars: [],
    dependencies: [],
    systemRequirements: ["python", "pip"],
    postInstallSteps: [
      { id: "install-playwright", label: "Install Playwright", type: "command", command: "pip3 install playwright>=1.40.0", timeout: 120 },
      { id: "install-chromium", label: "Install Chromium browser", type: "command", command: "playwright install chromium", timeout: 300 },
      { id: "install-deps", label: "Install system dependencies", type: "command", command: "playwright install-deps chromium 2>/dev/null || echo 'System deps may need manual install'", timeout: 120 },
    ],
    healthChecks: [
      { type: "python-import", importPath: "playwright.sync_api", description: "Playwright Python module importable" },
      { type: "command", command: "python3 -c \"from playwright.sync_api import sync_playwright; print('Playwright OK')\"", description: "Playwright functional" },
    ],
  },

  docker: {
    envVars: [],
    dependencies: [],
    systemRequirements: [],
    postInstallSteps: [
      { id: "check-existing", label: "Check for existing Docker", type: "command", command: "docker --version 2>/dev/null && echo 'ALREADY_INSTALLED' || echo 'NOT_INSTALLED'", timeout: 10 },
      { id: "install-docker", label: "Install Docker CE", type: "command", command: "curl -fsSL https://get.docker.com | sh", timeout: 600 },
      { id: "add-user", label: "Add user to docker group", type: "command", command: "sudo usermod -aG docker $USER 2>/dev/null || echo 'usermod skipped'", timeout: 15 },
      { id: "start-docker", label: "Start Docker daemon", type: "command", command: "sudo systemctl enable --now docker 2>/dev/null || sudo service docker start 2>/dev/null || echo 'Docker start skipped'", timeout: 30 },
    ],
    healthChecks: [
      { type: "command", command: "docker --version", description: "Docker CLI installed" },
      { type: "command", command: "docker info > /dev/null 2>&1 && echo 'Docker daemon OK'", description: "Docker daemon running" },
    ],
  },

  portainer: {
    envVars: [
      { name: "PORTAINER_PORT", description: "Portainer web UI port", required: false, secret: false, defaultValue: "9443" },
    ],
    dependencies: [
      { slug: "docker", reason: "Portainer runs as a Docker container" },
    ],
    systemRequirements: ["docker"],
    postInstallSteps: [
      { id: "pull-image", label: "Pull Portainer CE image", type: "command", command: "docker pull portainer/portainer-ce:latest", timeout: 300 },
      { id: "create-volume", label: "Create Portainer data volume", type: "command", command: "docker volume create portainer_data", timeout: 15 },
      { id: "remove-existing", label: "Remove existing container", type: "command", command: "docker rm -f portainer 2>/dev/null || true", timeout: 15 },
      { id: "run-container", label: "Start Portainer container", type: "command", command: "docker run -d --name portainer --restart=unless-stopped -p ${PORTAINER_PORT:-9443}:9443 -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest", timeout: 60 },
    ],
    healthChecks: [
      { type: "command", command: "docker ps --filter name=portainer --format '{{.Status}}' | grep -q Up && echo 'Portainer running'", description: "Portainer container running" },
      { type: "http", url: "https://localhost:9443", description: "Portainer web UI accessible" },
    ],
  },

  tailscale: {
    envVars: [
      { name: "TAILSCALE_AUTH_KEY", description: "Tailscale auth key for headless authentication (get from admin.tailscale.com)", required: true, secret: true },
    ],
    dependencies: [],
    systemRequirements: [],
    postInstallSteps: [
      { id: "check-existing", label: "Check for existing Tailscale", type: "command", command: "tailscale --version 2>/dev/null && echo 'ALREADY_INSTALLED' || echo 'NOT_INSTALLED'", timeout: 10 },
      { id: "install-tailscale", label: "Install Tailscale", type: "command", command: "curl -fsSL https://tailscale.com/install.sh | sh", timeout: 120 },
      { id: "start-tailscale", label: "Start Tailscale and authenticate", type: "command", command: "sudo tailscale up --authkey=$TAILSCALE_AUTH_KEY", timeout: 60 },
    ],
    healthChecks: [
      { type: "command", command: "tailscale status 2>/dev/null | head -1", description: "Tailscale connected" },
    ],
  },

  "hello-plugin": {
    envVars: [],
    dependencies: [],
    systemRequirements: [],
    postInstallSteps: [],
    healthChecks: [
      { type: "command", command: "echo 'Hello Plugin OK'", description: "Plugin activates without error" },
    ],
  },

  "solidity-auditor": {
    envVars: [],
    dependencies: [],
    systemRequirements: [],
    postInstallSteps: [
      { id: "copy-skills", label: "Copy skills to agent", type: "copy-skills", timeout: 60 },
      { id: "verify-skills", label: "Verify skill files copied", type: "command", command: "ls -la $PLUGIN_DIR/repo/solidity-auditor/SKILL.md && echo 'Skill file found'", timeout: 15 },
    ],
    uninstallSteps: [
      { id: "remove-skills", label: "Remove copied skill files", type: "command", command: "rm -rf $MULTICLAW_SKILLS_DIR/solidity-auditor 2>/dev/null; echo 'Skills removed'", timeout: 15 },
    ],
    healthChecks: [
      { type: "file-exists", filePath: "$PLUGIN_DIR/repo/solidity-auditor/SKILL.md", description: "Solidity auditor skill file present" },
      { type: "file-exists", filePath: "$PLUGIN_DIR/repo/solidity-auditor/references/attack-vectors/attack-vectors.md", description: "Attack vectors reference database present" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

function upsertPlugin(
  slug: string,
  values: {
    name: string;
    description: string;
    version: string;
    author: string;
    repoUrl: string;
    type: string;
  }
) {
  const manifest = manifests[slug] ? JSON.stringify(manifests[slug]) : null;
  const existing = db
    .select()
    .from(pluginRegistry)
    .where(sql`${pluginRegistry.slug} = ${slug}`)
    .get();
  if (!existing) {
    db.insert(pluginRegistry)
      .values({ id: uuid(), slug, manifest, ...values })
      .run();
  } else {
    // Sync manifest and type for existing entries
    const updates: Record<string, string | null> = { updatedAt: new Date().toISOString() };
    if (!existing.manifest && manifest) updates.manifest = manifest;
    if (existing.type !== values.type) updates.type = values.type;
    if (Object.keys(updates).length > 1) {
      db.update(pluginRegistry)
        .set(updates)
        .where(sql`${pluginRegistry.slug} = ${slug}`)
        .run();
    }
  }
}

export function seedPluginRegistry() {
  // --- External git plugins ---

  upsertPlugin("superpowers", {
    name: "Superpowers",
    description: "Complete development workflow skills for AI coding agents. Includes TDD, systematic debugging, brainstorming, code review, parallel agents, and more.",
    version: "5.0.5",
    author: "Jesse Vincent",
    repoUrl: "https://github.com/obra/superpowers",
    type: "git-plugin",
  });

  upsertPlugin("shannon", {
    name: "Shannon",
    description: "Autonomous white-box AI pentester for web applications and APIs. Analyzes source code, identifies attack vectors, and executes real exploits to prove vulnerabilities before production.",
    version: "1.0.0",
    author: "KeygraphHQ",
    repoUrl: "https://github.com/KeygraphHQ/shannon",
    type: "git-plugin",
  });

  upsertPlugin("agentpay-sdk", {
    name: "AgentPay SDK",
    description: "Open SDK for agentic payments. Let AI agents hold, transfer, and manage USD1 with operator-defined spending policies and self-custodial wallets on EVM-compatible networks.",
    version: "1.0.0",
    author: "World Liberty Financial",
    repoUrl: "https://github.com/worldliberty/agentpay-sdk",
    type: "git-plugin",
  });

  upsertPlugin("agentpay-skill-pack", {
    name: "AgentPay Skill Pack",
    description: "AI agent skill pack for wallet setup, funding, transfers, approvals, and policy configuration with AgentPay SDK. Enables agents to manage USD1 payment workflows.",
    version: "1.0.0",
    author: "World Liberty Financial",
    repoUrl: "https://github.com/worldliberty/agentpay-sdk",
    type: "git-plugin",
  });

  upsertPlugin("bankr-agent", {
    name: "Bankr Agent",
    description: "Crypto trading, market analysis, and Polymarket prediction betting via the Bankr API. Supports Base, Ethereum, Solana, and more.",
    version: "1.0.0",
    author: "BankrBot",
    repoUrl: "https://github.com/BankrBot/claude-plugins",
    type: "git-plugin",
  });

  upsertPlugin("solidity-auditor", {
    name: "Solidity Auditor",
    description: "AI-powered security auditor for Solidity smart contracts by Pashov Audit Group. Runs 8 specialized agents in parallel (vector scan, math precision, access control, economic security, execution trace, invariant, periphery, first principles) to find vulnerabilities in under 5 minutes.",
    version: "2.0.0",
    author: "Pashov Audit Group",
    repoUrl: "https://github.com/pashov/skills",
    type: "git-plugin",
  });

  // --- Built-in plugins ---

  upsertPlugin("browser-control", {
    name: "Browser Control",
    description: "Browser automation via Playwright. Navigate pages, fill forms, click elements, extract content, take screenshots, and manage tabs — all from agent tasks. Supports Chromium, Firefox, and WebKit with configurable headless/visible mode.",
    version: "1.0.0",
    author: "MultiClaw",
    repoUrl: "https://github.com/a2-stuff/MultiClaw",
    type: "built-in",
  });

  upsertPlugin("docker", {
    name: "Docker",
    description: "Install and manage Docker containers on the agent host. Pull images, create/start/stop/remove containers, inspect state, and control container lifecycle.",
    version: "1.0.0",
    author: "MultiClaw",
    repoUrl: "https://github.com/a2-stuff/MultiClaw",
    type: "built-in",
  });

  upsertPlugin("portainer", {
    name: "Portainer",
    description: "Install Portainer CE Docker management UI on the agent host for visual container management via a web-based GUI.",
    version: "1.0.0",
    author: "MultiClaw",
    repoUrl: "https://github.com/a2-stuff/MultiClaw",
    type: "built-in",
  });

  upsertPlugin("tailscale", {
    name: "Tailscale",
    description: "Tailscale VPN mesh networking for secure, zero-config agent-to-dashboard communication with automatic peer discovery.",
    version: "1.0.0",
    author: "MultiClaw",
    repoUrl: "https://github.com/a2-stuff/MultiClaw",
    type: "built-in",
  });

  upsertPlugin("hello-plugin", {
    name: "Hello Plugin",
    description: "Minimal example plugin demonstrating the plugin interface. Use as a template for building custom plugins.",
    version: "1.0.0",
    author: "MultiClaw",
    repoUrl: "https://github.com/a2-stuff/MultiClaw",
    type: "built-in",
  });

  // --- Skill providers ---

  const skillssh = db
    .select()
    .from(skillProviders)
    .where(sql`${skillProviders.type} = 'skillssh'`)
    .get();
  if (!skillssh) {
    db.insert(skillProviders).values({
      id: uuid(),
      name: "skills.sh",
      type: "skillssh",
      apiBaseUrl: "https://skills.sh/api",
      enabled: true,
    }).run();
  }
}
