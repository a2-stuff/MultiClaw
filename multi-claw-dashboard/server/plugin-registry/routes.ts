import { Router } from "express";
import { v4 as uuid } from "uuid";
import { eq, and, inArray } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/index.js";
import { pluginRegistry, agentRegistryPlugins, agents } from "../db/schema.js";
import { requireAuth } from "../auth/middleware.js";
import { resolveAgentUrl } from "../tailscale/helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_DIR = path.join(__dirname, "..", "uploads", "registry-plugins");

const router = Router();
router.use(requireAuth);

// Helper: safely parse manifest JSON
function parseManifest(raw: string | null): object | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Helper: fetch a single plugin with agent statuses
function getPluginWithStatuses(id: string) {
  const plugin = db.select().from(pluginRegistry).where(eq(pluginRegistry.id, id)).get();
  if (!plugin) return null;
  const statuses = db
    .select()
    .from(agentRegistryPlugins)
    .where(eq(agentRegistryPlugins.registryPluginId, id))
    .all();
  return { ...plugin, manifest: parseManifest(plugin.manifest ?? null), agents: statuses };
}

// GET / — list all registry plugins with per-agent deployment statuses
router.get("/", (_req, res) => {
  const all = db.select().from(pluginRegistry).all();
  const result = all.map((plugin) => {
    const statuses = db
      .select()
      .from(agentRegistryPlugins)
      .where(eq(agentRegistryPlugins.registryPluginId, plugin.id))
      .all();
    return { ...plugin, manifest: parseManifest(plugin.manifest ?? null), agents: statuses };
  });
  res.json(result);
});

// POST / — create new registry entry
router.post("/", async (req, res) => {
  const { name, slug, description, version, author, repoUrl } = req.body;
  if (!name || !slug) return res.status(400).json({ error: "name and slug are required" });

  const existing = db
    .select()
    .from(pluginRegistry)
    .where(eq(pluginRegistry.slug, slug))
    .get();
  if (existing) return res.status(409).json({ error: `Plugin with slug '${slug}' already exists` });

  const id = uuid();
  db.insert(pluginRegistry).values({
    id, name, slug, description, version, author, repoUrl, type: "git-plugin",
  }).run();
  res.status(201).json(getPluginWithStatuses(id));
});

// GET /:id — single entry with agent statuses
router.get("/:id", (req, res) => {
  const plugin = getPluginWithStatuses(req.params.id);
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });
  res.json(plugin);
});

// PUT /:id — update entry fields
router.put("/:id", (req, res) => {
  const plugin = db.select().from(pluginRegistry).where(eq(pluginRegistry.id, req.params.id)).get();
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  const { name, slug, description, version, author, repoUrl } = req.body;
  const updates: Record<string, string | undefined> = {};
  if (name !== undefined) updates.name = name;
  if (slug !== undefined) {
    // Check slug uniqueness if changing
    if (slug !== plugin.slug) {
      const conflict = db.select().from(pluginRegistry).where(eq(pluginRegistry.slug, slug)).get();
      if (conflict) return res.status(409).json({ error: `Slug '${slug}' already in use` });
    }
    updates.slug = slug;
  }
  if (description !== undefined) updates.description = description;
  if (version !== undefined) updates.version = version;
  if (author !== undefined) updates.author = author;
  if (repoUrl !== undefined) updates.repoUrl = repoUrl;
  updates.updatedAt = new Date().toISOString();

  db.update(pluginRegistry).set(updates).where(eq(pluginRegistry.id, req.params.id)).run();
  res.json(getPluginWithStatuses(req.params.id));
});

// DELETE /:id — remove entry and all agent_registry_plugins rows
router.delete("/:id", (req, res) => {
  const plugin = db.select().from(pluginRegistry).where(eq(pluginRegistry.id, req.params.id)).get();
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  db.delete(agentRegistryPlugins).where(eq(agentRegistryPlugins.registryPluginId, req.params.id)).run();
  db.delete(pluginRegistry).where(eq(pluginRegistry.id, req.params.id)).run();
  res.json({ success: true });
});

// POST /:id/deploy — deploy to specified agents
router.post("/:id/deploy", async (req, res) => {
  const plugin = db.select().from(pluginRegistry).where(eq(pluginRegistry.id, req.params.id)).get();
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  const { agentIds, envVars } = req.body as { agentIds: string[]; envVars?: Record<string, string> };
  if (!Array.isArray(agentIds) || agentIds.length === 0) {
    return res.status(400).json({ error: "agentIds array required" });
  }

  // Parse manifest for dependency validation and forwarding
  const manifest = plugin.manifest ? JSON.parse(plugin.manifest) : null;

  // Validate dependencies before deploying
  if (manifest?.dependencies?.length) {
    const allRegistryPlugins = db.select().from(pluginRegistry).all();
    const slugToId = new Map(allRegistryPlugins.map((p) => [p.slug, p.id]));

    for (const agentId of agentIds) {
      const installedOnAgent = db
        .select()
        .from(agentRegistryPlugins)
        .where(eq(agentRegistryPlugins.agentId, agentId))
        .all()
        .filter((r) => r.status === "installed");

      const installedPluginIds = new Set(installedOnAgent.map((r) => r.registryPluginId));
      const missing = manifest.dependencies.filter((dep: { slug: string; reason: string }) => {
        const depId = slugToId.get(dep.slug);
        return !depId || !installedPluginIds.has(depId);
      });

      if (missing.length > 0) {
        return res.status(400).json({
          error: "Missing dependencies",
          missing: missing.map((d: { slug: string; reason: string }) => ({
            slug: d.slug,
            reason: d.reason,
          })),
          agentId,
        });
      }
    }
  }

  const agentRows = db.select().from(agents).where(inArray(agents.id, agentIds)).all();
  // Use longer timeout for manifest-driven installs (600s vs 60s)
  const deployTimeout = manifest ? 600000 : 60000;

  const results = await Promise.allSettled(
    agentRows.map(async (agent) => {
      // Upsert tracking row
      const existing = db
        .select()
        .from(agentRegistryPlugins)
        .where(
          and(
            eq(agentRegistryPlugins.agentId, agent.id),
            eq(agentRegistryPlugins.registryPluginId, plugin.id)
          )
        )
        .get();

      const trackId = existing?.id ?? uuid();
      if (!existing) {
        db.insert(agentRegistryPlugins).values({
          id: trackId,
          agentId: agent.id,
          registryPluginId: plugin.id,
          status: "installing",
        }).run();
      } else {
        db.update(agentRegistryPlugins)
          .set({ status: "installing", error: null, updatedAt: new Date().toISOString() })
          .where(eq(agentRegistryPlugins.id, trackId))
          .run();
      }

      try {
        const agentUrl = resolveAgentUrl(agent);
        let response: Response;

        if (plugin.repoUrl) {
          // Git-based plugin: clone on agent with manifest + env vars
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), deployTimeout);
          response = await fetch(`${agentUrl}/api/plugins/install-git`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": agent.apiKey,
            },
            body: JSON.stringify({
              name: plugin.name,
              slug: plugin.slug,
              repo_url: plugin.repoUrl,
              manifest: manifest || undefined,
              env_vars: envVars || undefined,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
        } else {
          // Bundle plugin: transfer files from dashboard
          const bundlePath = path.join(BUNDLE_DIR, plugin.slug);
          if (!fs.existsSync(bundlePath)) {
            db.update(agentRegistryPlugins)
              .set({ status: "failed", error: "Plugin bundle not found on dashboard", updatedAt: new Date().toISOString() })
              .where(eq(agentRegistryPlugins.id, trackId))
              .run();
            return { agentId: agent.id, success: false, error: "Plugin bundle not found on dashboard" };
          }

          const files = fs.readdirSync(bundlePath).filter((f) => !f.startsWith("."));
          const form = new FormData();
          form.append("metadata", JSON.stringify({
            name: plugin.slug,
            description: plugin.description || "",
            version: plugin.version || "1.0.0",
          }));
          for (const file of files) {
            const content = fs.readFileSync(path.join(bundlePath, file));
            form.append("files", new Blob([content]), file);
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 60000);
          response = await fetch(`${agentUrl}/api/plugins/install`, {
            method: "POST",
            headers: { "X-API-Key": agent.apiKey },
            body: form,
            signal: controller.signal,
          });
          clearTimeout(timeout);
        }

        if (!response.ok) {
          const errBody = await response.text().catch(() => "unknown error");
          db.update(agentRegistryPlugins)
            .set({ status: "failed", error: errBody, updatedAt: new Date().toISOString() })
            .where(eq(agentRegistryPlugins.id, trackId))
            .run();
          return { agentId: agent.id, success: false, error: errBody };
        }

        const data = await response.json().catch(() => ({})) as Record<string, unknown>;
        db.update(agentRegistryPlugins)
          .set({
            status: "installed",
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            error: null,
          })
          .where(eq(agentRegistryPlugins.id, trackId))
          .run();
        return { agentId: agent.id, success: true, skills_count: (data as any).skills_count };
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        db.update(agentRegistryPlugins)
          .set({ status: "failed", error: errMsg, updatedAt: new Date().toISOString() })
          .where(eq(agentRegistryPlugins.id, trackId))
          .run();
        return { agentId: agent.id, success: false, error: errMsg };
      }
    })
  );

  const output = results.map((r) =>
    r.status === "fulfilled" ? r.value : { agentId: "unknown", success: false, error: String(r.reason) }
  );
  res.json(output);
});

// POST /:id/undeploy — undeploy from specified agents
router.post("/:id/undeploy", async (req, res) => {
  const plugin = db.select().from(pluginRegistry).where(eq(pluginRegistry.id, req.params.id)).get();
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  const { agentIds } = req.body as { agentIds: string[] };
  if (!Array.isArray(agentIds) || agentIds.length === 0) {
    return res.status(400).json({ error: "agentIds array required" });
  }

  const agentRows = db.select().from(agents).where(inArray(agents.id, agentIds)).all();

  const results = await Promise.allSettled(
    agentRows.map(async (agent) => {
      const trackRow = db
        .select()
        .from(agentRegistryPlugins)
        .where(
          and(
            eq(agentRegistryPlugins.agentId, agent.id),
            eq(agentRegistryPlugins.registryPluginId, plugin.id)
          )
        )
        .get();

      if (trackRow) {
        db.update(agentRegistryPlugins)
          .set({ status: "uninstalling", updatedAt: new Date().toISOString() })
          .where(eq(agentRegistryPlugins.id, trackRow.id))
          .run();
      }

      try {
        const agentUrl = resolveAgentUrl(agent);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(`${agentUrl}/api/plugins/${plugin.slug}`, {
          method: "DELETE",
          headers: { "X-API-Key": agent.apiKey },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok && response.status !== 404) {
          const errBody = await response.text().catch(() => "unknown error");
          if (trackRow) {
            db.update(agentRegistryPlugins)
              .set({ status: "failed", error: errBody, updatedAt: new Date().toISOString() })
              .where(eq(agentRegistryPlugins.id, trackRow.id))
              .run();
          }
          return { agentId: agent.id, success: false, error: errBody };
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (trackRow) {
          db.update(agentRegistryPlugins)
            .set({ status: "failed", error: errMsg, updatedAt: new Date().toISOString() })
            .where(eq(agentRegistryPlugins.id, trackRow.id))
            .run();
        }
        return { agentId: agent.id, success: false, error: errMsg };
      }

      // Remove tracking row on success
      if (trackRow) {
        db.delete(agentRegistryPlugins).where(eq(agentRegistryPlugins.id, trackRow.id)).run();
      }
      return { agentId: agent.id, success: true };
    })
  );

  const output = results.map((r) =>
    r.status === "fulfilled" ? r.value : { agentId: "unknown", success: false, error: String(r.reason) }
  );
  res.json(output);
});

// POST /:id/update — update plugin on specified agents
router.post("/:id/update", async (req, res) => {
  const plugin = db.select().from(pluginRegistry).where(eq(pluginRegistry.id, req.params.id)).get();
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  const { agentIds } = req.body as { agentIds: string[] };
  if (!Array.isArray(agentIds) || agentIds.length === 0) {
    return res.status(400).json({ error: "agentIds array required" });
  }

  const agentRows = db.select().from(agents).where(inArray(agents.id, agentIds)).all();

  const results = await Promise.allSettled(
    agentRows.map(async (agent) => {
      const trackRow = db
        .select()
        .from(agentRegistryPlugins)
        .where(
          and(
            eq(agentRegistryPlugins.agentId, agent.id),
            eq(agentRegistryPlugins.registryPluginId, plugin.id)
          )
        )
        .get();

      if (trackRow) {
        db.update(agentRegistryPlugins)
          .set({ status: "updating", updatedAt: new Date().toISOString() })
          .where(eq(agentRegistryPlugins.id, trackRow.id))
          .run();
      }

      try {
        const agentUrl = resolveAgentUrl(agent);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(`${agentUrl}/api/plugins/${plugin.slug}/update-git`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": agent.apiKey,
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const errBody = await response.text().catch(() => "unknown error");
          if (trackRow) {
            db.update(agentRegistryPlugins)
              .set({ status: "failed", error: errBody, updatedAt: new Date().toISOString() })
              .where(eq(agentRegistryPlugins.id, trackRow.id))
              .run();
          }
          return { agentId: agent.id, success: false, error: errBody };
        }

        if (trackRow) {
          db.update(agentRegistryPlugins)
            .set({
              status: "installed",
              updatedAt: new Date().toISOString(),
              error: null,
            })
            .where(eq(agentRegistryPlugins.id, trackRow.id))
            .run();
        }
        return { agentId: agent.id, success: true };
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (trackRow) {
          db.update(agentRegistryPlugins)
            .set({ status: "failed", error: errMsg, updatedAt: new Date().toISOString() })
            .where(eq(agentRegistryPlugins.id, trackRow.id))
            .run();
        }
        return { agentId: agent.id, success: false, error: errMsg };
      }
    })
  );

  const output = results.map((r) =>
    r.status === "fulfilled" ? r.value : { agentId: "unknown", success: false, error: String(r.reason) }
  );
  res.json(output);
});

// GET /:id/health/:agentId — proxy health check to agent
router.get("/:id/health/:agentId", async (req, res) => {
  const plugin = db.select().from(pluginRegistry).where(eq(pluginRegistry.id, req.params.id)).get();
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  const agent = db.select().from(agents).where(eq(agents.id, req.params.agentId)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  try {
    const agentUrl = resolveAgentUrl(agent);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(`${agentUrl}/api/plugins/${plugin.slug}/health`, {
      headers: { "X-API-Key": agent.apiKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ healthy: false, error: err?.message || "Agent unreachable" });
  }
});

// GET /:id/manifest — get parsed manifest for a plugin
router.get("/:id/manifest", (req, res) => {
  const plugin = db.select().from(pluginRegistry).where(eq(pluginRegistry.id, req.params.id)).get();
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  if (!plugin.manifest) return res.json(null);
  try {
    res.json(JSON.parse(plugin.manifest));
  } catch {
    res.json(null);
  }
});

export { router as pluginRegistryRouter };
