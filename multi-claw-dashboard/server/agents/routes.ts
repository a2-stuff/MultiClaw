import { Router } from "express";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import path from "path";
import os from "os";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents, agentSkills, agentPlugins, agentRegistryPlugins, agentTasks, skills, plugins, pluginRegistry, apiKeys, settings } from "../db/schema.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { resolveAgentUrl } from "../tailscale/helpers.js";
import { validateAgentUrl } from "./url-validation.js";
import { spawnLocalAgent, stopSpawnedAgent, startSpawnedAgent } from "./spawn.js";
import { optimizeIdentity } from "./optimize.js";
import { spawnDockerAgent, stopDockerAgent, startDockerAgent, deleteDockerAgent, getContainerLogs, isDockerAvailable } from "./docker-spawn.js";
import { auditFromReq } from "../audit/logger.js";

const router = Router();
router.use(requireAuth);

/** Create a management API key (mck_) for an agent so it shows on the Keys page. */
function ensureManagementKey(agentId: string, agentName: string, createdBy: string): void {
  const existing = db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.agentId, agentId)).get();
  if (existing) return;
  const rawKey = `mck_${crypto.randomBytes(32).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  db.insert(apiKeys).values({
    id: uuid(),
    name: `${agentName}-key`,
    keyHash,
    keyPrefix: rawKey.slice(0, 12),
    agentId,
    createdBy,
  }).run();
}

router.post("/", requireRole("canManageAgents"), async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ error: "name and url required" });
    if (!validateAgentUrl(url)) return res.status(400).json({ error: "Invalid agent URL. Must be http:// or https://" });
    const id = uuid();
    const apiKey = `mca_${crypto.randomBytes(32).toString("hex")}`;
    db.insert(agents).values({ id, name, url, apiKey, registeredBy: req.user!.id }).run();
    ensureManagementKey(id, name, req.user!.id);
    auditFromReq(req, "agent.create", { type: "agent", id }, { name, url });
    res.status(201).json({ agent: { id, name, url, status: "offline" }, apiKey });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes("FOREIGN KEY")) {
      return res.status(400).json({ error: "Your user account was not found. Please log out and log back in." });
    }
    console.error("Agent registration error:", msg);
    res.status(500).json({ error: "Failed to register agent" });
  }
});

router.post("/spawn", requireRole("canManageAgents"), async (req, res) => {
  try {
    const { name, dashboardUrl } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "name required" });
    }
    if (name.trim().length > 64) {
      return res.status(400).json({ error: "name must be 64 characters or less" });
    }

    // Resolve template if provided
    let templateConfig: any = {};
    if (req.body.templateId) {
      const { agentTemplates } = await import("../db/schema.js");
      const template = db.select().from(agentTemplates).where(eq(agentTemplates.id, req.body.templateId)).get();
      if (!template) return res.status(400).json({ error: "Template not found" });
      templateConfig = template;
    }

    const result = await spawnLocalAgent(
      { name: name.trim(), dashboardUrl },
      req.user!.id
    );

    if (req.body.templateId) {
      db.update(agents).set({
        templateId: req.body.templateId,
        defaultProvider: templateConfig.provider || "anthropic",
        defaultModel: templateConfig.model || "claude-sonnet-4-6",
      }).where(eq(agents.id, result.agentId)).run();
    }

    ensureManagementKey(result.agentId, name.trim(), req.user!.id);
    auditFromReq(req, "agent.spawn", { type: "agent", id: result.agentId }, { name: req.body.name, port: result.port });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to spawn agent" });
  }
});

router.post("/:id/stop-spawned", requireRole("canManageAgents"), async (req, res) => {
  try {
    stopSpawnedAgent(req.params.id);
    auditFromReq(req, "agent.stop", { type: "agent", id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to stop agent" });
  }
});

router.post("/:id/start-spawned", requireRole("canManageAgents"), async (req, res) => {
  try {
    const pid = startSpawnedAgent(req.params.id);
    auditFromReq(req, "agent.start", { type: "agent", id: req.params.id });
    res.json({ success: true, pid });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to start agent" });
  }
});

router.post("/spawn-docker", requireRole("canManageAgents"), async (req, res) => {
  try {
    const { name, memoryLimit, cpuLimit, dashboardUrl } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "name required" });
    }
    const result = await spawnDockerAgent(
      { name: name.trim(), memoryLimit, cpuLimit, dashboardUrl },
      req.user!.id
    );
    ensureManagementKey(result.agentId, name.trim(), req.user!.id);
    auditFromReq(req, "agent.docker_spawn", { type: "agent", id: result.agentId }, { containerId: result.containerId });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to spawn Docker agent" });
  }
});

router.post("/:id/docker-stop", requireRole("canManageAgents"), async (req, res) => {
  try {
    await stopDockerAgent(req.params.id);
    auditFromReq(req, "agent.docker_stop", { type: "agent", id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to stop container" });
  }
});

router.post("/:id/docker-start", requireRole("canManageAgents"), async (req, res) => {
  try {
    await startDockerAgent(req.params.id);
    auditFromReq(req, "agent.docker_start", { type: "agent", id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to start container" });
  }
});

router.get("/:id/container-logs", async (req, res) => {
  try {
    const tail = parseInt(req.query.tail as string) || 100;
    const logs = await getContainerLogs(req.params.id, tail);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to get logs" });
  }
});

router.get("/docker-status", async (_req, res) => {
  const available = await isDockerAvailable();
  res.json({ available });
});

router.get("/", async (_req, res) => {
  const allAgents = db.select({
    id: agents.id, name: agents.name, url: agents.url, status: agents.status,
    lastSeen: agents.lastSeen, createdAt: agents.createdAt,
    defaultProvider: agents.defaultProvider, defaultModel: agents.defaultModel,
    spawnedLocally: agents.spawnedLocally, spawnPid: agents.spawnPid,
    spawnPort: agents.spawnPort, spawnDir: agents.spawnDir, spawnHost: agents.spawnHost,
    templateId: agents.templateId, identity: agents.identity,
    containerId: agents.containerId, containerImage: agents.containerImage,
    containerStatus: agents.containerStatus,
  }).from(agents).all();
  const sanitized = allAgents.map(({ spawnDir, spawnPid, containerId, containerImage, ...safe }) => safe);
  res.json(sanitized);
});

// Update agent model configuration
router.patch("/:id/model", requireRole("canManageAgents"), async (req, res) => {
  const { provider, model } = req.body;
  if (!provider || !model) return res.status(400).json({ error: "provider and model required" });
  const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  db.update(agents).set({ defaultProvider: provider, defaultModel: model }).where(eq(agents.id, req.params.id)).run();
  res.json({ success: true, provider, model });
});

router.get("/:id", async (req, res) => {
  const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const { apiKey, spawnDir, spawnPid, containerId, containerImage, ...safe } = agent;
  res.json(safe);
});

router.patch("/:id", requireRole("canManageAgents"), async (req, res) => {
  const { name, url } = req.body;
  if (!name && !url) return res.status(400).json({ error: "name or url required" });
  if (url && !validateAgentUrl(url)) return res.status(400).json({ error: "Invalid agent URL. Must be http:// or https://" });
  const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const updates: Record<string, string> = {};
  if (name) updates.name = name;
  if (url) updates.url = url;
  db.update(agents).set(updates).where(eq(agents.id, req.params.id)).run();
  auditFromReq(req, "agent.update", { type: "agent", id: req.params.id });
  res.json({ success: true, ...updates });
});

router.patch("/:id/identity", requireRole("canManageAgents"), async (req, res) => {
  const { identity } = req.body;
  if (typeof identity !== "string") return res.status(400).json({ error: "identity must be a string" });
  const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  db.update(agents).set({ identity }).where(eq(agents.id, req.params.id)).run();
  // Push identity to agent
  try {
    await fetch(`${resolveAgentUrl(agent)}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": agent.apiKey },
      body: JSON.stringify({ identity }),
    });
  } catch {}
  res.json({ success: true });
});

router.post("/:id/optimize-identity", requireRole("canManageAgents"), async (req, res) => {
  try {
    const { identity, intensity } = req.body;
    if (!identity || typeof identity !== "string" || identity.trim().length === 0) {
      return res.status(400).json({ error: "identity text is required" });
    }
    if (identity.length > 50000) {
      return res.status(400).json({ error: "identity must be 50,000 characters or fewer" });
    }
    const validIntensities = ["light", "medium", "heavy"];
    if (!intensity || !validIntensities.includes(intensity)) {
      return res.status(400).json({ error: "intensity must be one of: light, medium, heavy" });
    }

    const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    // Read global Anthropic API key from settings table
    const row = db.select().from(settings).where(eq(settings.key, "anthropic_api_key")).get();
    if (!row?.value) {
      return res.status(422).json({ error: "No Anthropic API key configured in dashboard settings" });
    }

    const optimized = await optimizeIdentity(identity, intensity, row.value);
    res.json({ optimized });
  } catch (err: any) {
    console.error("Optimize identity error:", err.message || err);
    res.status(500).json({ error: err.message || "Failed to optimize identity" });
  }
});

router.delete("/:id", requireRole("canManageAgents"), async (req, res) => {
  const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  // Clean up spawned agent: kill process and remove directory
  if (agent.spawnedLocally && agent.spawnDir) {
    const AGENTS_BASE = path.join(os.homedir(), ".multiclaw", "agents");
    const resolved = path.resolve(agent.spawnDir);
    if (!resolved.startsWith(path.resolve(AGENTS_BASE) + path.sep)) {
      return res.status(400).json({ error: "Invalid spawn directory" });
    }
    if (agent.spawnPid) {
      try { process.kill(agent.spawnPid, "SIGTERM"); } catch {}
    }
    try {
      const { rmSync } = await import("fs");
      rmSync(agent.spawnDir, { recursive: true, force: true });
    } catch {}
  }

  db.delete(agents).where(eq(agents.id, req.params.id)).run();
  auditFromReq(req, "agent.delete", { type: "agent", id: req.params.id }, { name: agent?.name });
  res.json({ success: true });
});

router.post("/:id/regenerate-key", requireRole("canManageAgents"), async (req, res) => {
  const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const newKey = `mca_${crypto.randomBytes(32).toString("hex")}`;
  db.update(agents).set({ apiKey: newKey }).where(eq(agents.id, req.params.id)).run();
  res.json({ apiKey: newKey });
});

router.get("/:id/stats", async (req, res) => {
  const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const skillCount = db.select().from(agentSkills).where(eq(agentSkills.agentId, req.params.id)).all().length;
  const pluginCount = db.select().from(agentPlugins).where(eq(agentPlugins.agentId, req.params.id)).all().length;
  const allTasks = db.select().from(agentTasks).where(eq(agentTasks.agentId, req.params.id)).all();
  const taskCount = allTasks.length;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentTaskCount = allTasks.filter(t => t.createdAt >= twentyFourHoursAgo).length;
  res.json({ skillCount, pluginCount, taskCount, recentTaskCount });
});

router.get("/:id/skills", async (req, res) => {
  const rows = db.select({
    id: agentSkills.id, skillId: agentSkills.skillId, skillName: skills.name,
    skillVersion: skills.version, status: agentSkills.status, installedAt: agentSkills.installedAt,
  }).from(agentSkills).innerJoin(skills, eq(agentSkills.skillId, skills.id))
    .where(eq(agentSkills.agentId, req.params.id)).all();
  res.json(rows);
});

router.post("/:id/skills", requireRole("canManageAgents"), async (req, res) => {
  const { skillId } = req.body;
  if (!skillId) return res.status(400).json({ error: "skillId required" });
  const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const id = uuid();
  db.insert(agentSkills).values({ id, agentId: req.params.id, skillId, status: "installed" }).run();
  res.status(201).json({ id, skillId, status: "installed" });
});

router.delete("/:id/skills/:skillId", requireRole("canManageAgents"), async (req, res) => {
  const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const skill = db.select().from(skills).where(eq(skills.id, req.params.skillId)).get();

  // Remove files from the agent if it's reachable
  if (skill) {
    try {
      await fetch(`${resolveAgentUrl(agent)}/api/skills/${encodeURIComponent(skill.name)}`, {
        method: "DELETE",
        headers: { "X-API-Key": agent.apiKey },
      });
    } catch {
      // Agent may be offline — still remove from DB
    }
  }

  db.delete(agentSkills)
    .where(and(eq(agentSkills.agentId, req.params.id), eq(agentSkills.skillId, req.params.skillId)))
    .run();
  res.json({ success: true });
});

router.get("/:id/plugins", async (req, res) => {
  const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  // Fetch live plugin list from the agent (source of truth)
  try {
    const agentUrl = resolveAgentUrl(agent);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${agentUrl}/api/plugins/`, {
      headers: { "X-API-Key": agent.apiKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const agentPluginList = await response.json() as Array<Record<string, unknown>>;
      // Filter to only active/enabled plugins and map to AgentPlugin shape
      const result = agentPluginList
        .filter((p) => p.active !== false)
        .map((p, i) => ({
          id: String(p.slug || p.name || i),
          pluginId: String(p.slug || p.name || i),
          pluginName: String(p.name || "Unknown"),
          pluginVersion: String(p.version || "1.0.0"),
          enabled: p.enabled !== false,
          status: "installed" as const,
          installedAt: String(p.installed_at || new Date().toISOString()),
        }));
      return res.json(result);
    }
  } catch {
    // Agent unreachable — fall through to DB lookup
  }

  // Fallback: return plugins from legacy DB table if agent is offline
  const rows = db.select({
    id: agentPlugins.id, pluginId: agentPlugins.pluginId, pluginName: plugins.name,
    pluginVersion: plugins.version, enabled: agentPlugins.enabled,
    status: agentPlugins.status, installedAt: agentPlugins.installedAt,
  }).from(agentPlugins).innerJoin(plugins, eq(agentPlugins.pluginId, plugins.id))
    .where(eq(agentPlugins.agentId, req.params.id)).all();
  res.json(rows);
});

router.post("/:id/plugins", requireRole("canManageAgents"), async (req, res) => {
  const { pluginId } = req.body;
  if (!pluginId) return res.status(400).json({ error: "pluginId required" });
  const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const id = uuid();
  db.insert(agentPlugins).values({ id, agentId: req.params.id, pluginId, status: "installed" }).run();
  res.status(201).json({ id, pluginId, status: "installed" });
});

router.patch("/:id/plugins/:pluginId", requireRole("canManageAgents"), async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled (boolean) required" });
  db.update(agentPlugins).set({ enabled })
    .where(and(eq(agentPlugins.agentId, req.params.id), eq(agentPlugins.pluginId, req.params.pluginId))).run();
  res.json({ success: true, enabled });
});

router.delete("/:id/plugins/:pluginId", requireRole("canManageAgents"), async (req, res) => {
  const agent = db.select().from(agents).where(eq(agents.id, req.params.id)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const pluginIdOrSlug = req.params.pluginId;

  // 1. Tell the agent to uninstall the plugin
  let agentError: string | undefined;
  try {
    const agentUrl = resolveAgentUrl(agent);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const agentResp = await fetch(`${agentUrl}/api/plugins/${pluginIdOrSlug}`, {
      method: "DELETE",
      headers: { "X-API-Key": agent.apiKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!agentResp.ok) {
      const body = await agentResp.text().catch(() => "");
      agentError = body || `Agent returned ${agentResp.status}`;
    }
  } catch (err: any) {
    agentError = err?.message || "Agent unreachable";
  }

  // 2. Clean up legacy agentPlugins table
  db.delete(agentPlugins)
    .where(and(eq(agentPlugins.agentId, req.params.id), eq(agentPlugins.pluginId, pluginIdOrSlug))).run();

  // 3. Clean up registry tracking (agentRegistryPlugins) by slug match (try both dash/underscore variants)
  const slugVariants = [pluginIdOrSlug];
  if (pluginIdOrSlug.includes("-")) slugVariants.push(pluginIdOrSlug.replace(/-/g, "_"));
  else if (pluginIdOrSlug.includes("_")) slugVariants.push(pluginIdOrSlug.replace(/_/g, "-"));
  for (const variant of slugVariants) {
    const regPlugin = db.select().from(pluginRegistry).where(eq(pluginRegistry.slug, variant)).get();
    if (regPlugin) {
      db.delete(agentRegistryPlugins)
        .where(and(eq(agentRegistryPlugins.agentId, req.params.id), eq(agentRegistryPlugins.registryPluginId, regPlugin.id))).run();
      break;
    }
  }

  res.json({ success: true, ...(agentError ? { agentError } : {}) });
});

export { router as agentsRouter };
