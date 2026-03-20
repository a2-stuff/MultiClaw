import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db } from "../db/index.js";
import { agents, agentTasks } from "../db/schema.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { resolveAgentUrl } from "../tailscale/helpers.js";

const router = Router();
router.use(requireAuth);

router.post("/:agentId/tasks", async (req, res) => {
  const agent = db.select().from(agents).where(eq(agents.id, req.params.agentId)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  try {
    const resp = await fetch(`${resolveAgentUrl(agent)}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": agent.apiKey },
      body: JSON.stringify(req.body),
    });
    const result = await resp.json();
    const id = uuid();
    db.insert(agentTasks).values({
      id, agentId: agent.id, prompt: req.body.prompt, status: "queued", createdBy: req.user!.id,
    }).run();
    res.json(result);
  } catch (err: any) {
    console.error("Agent proxy error:", err);
    res.status(502).json({ error: "Failed to reach agent" });
  }
});

router.get("/:agentId/tasks", async (req, res) => {
  const tasks = db.select().from(agentTasks).where(eq(agentTasks.agentId, req.params.agentId)).all();
  res.json(tasks);
});

router.delete("/:agentId/tasks/:taskId", requireRole("canManageAgents"), async (req, res) => {
  const task = db.select().from(agentTasks).where(
    and(eq(agentTasks.id, req.params.taskId), eq(agentTasks.agentId, req.params.agentId))
  ).get();
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (task.status !== "queued") return res.status(400).json({ error: "Only queued tasks can be deleted" });
  db.delete(agentTasks).where(eq(agentTasks.id, req.params.taskId)).run();
  res.json({ success: true });
});

router.get("/:agentId/logs", async (req, res) => {
  const agent = db.select().from(agents).where(eq(agents.id, req.params.agentId)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  try {
    const limit = req.query.limit || "100";
    const level = req.query.level || "";
    const resp = await fetch(`${resolveAgentUrl(agent)}/api/logs?limit=${limit}&level=${level}`, {
      headers: { "X-API-Key": agent.apiKey },
    });
    const result = await resp.json();
    res.json(result);
  } catch {
    res.status(502).json({ error: "Failed to reach agent" });
  }
});

router.delete("/:agentId/logs", async (req, res) => {
  const agent = db.select().from(agents).where(eq(agents.id, req.params.agentId)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  try {
    const resp = await fetch(`${resolveAgentUrl(agent)}/api/logs`, {
      method: "DELETE",
      headers: { "X-API-Key": agent.apiKey },
    });
    const result = await resp.json();
    res.json(result);
  } catch {
    res.status(502).json({ error: "Failed to reach agent" });
  }
});

router.post("/:agentId/self-update", async (req, res) => {
  const agent = db.select().from(agents).where(eq(agents.id, req.params.agentId)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  try {
    const resp = await fetch(`${resolveAgentUrl(agent)}/api/self-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": agent.apiKey },
    });
    const result = await resp.json();
    res.status(resp.status).json(result);
  } catch (err: any) {
    console.error("Agent proxy error:", err);
    res.status(502).json({ error: "Failed to reach agent" });
  }
});

router.post("/:agentId/restart", async (req, res) => {
  const agent = db.select().from(agents).where(eq(agents.id, req.params.agentId)).get();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  try {
    const resp = await fetch(`${resolveAgentUrl(agent)}/api/restart`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": agent.apiKey },
    });
    const result = await resp.json();
    res.status(resp.status).json(result);
  } catch (err: any) {
    console.error("Agent proxy error:", err);
    res.status(502).json({ error: "Failed to reach agent" });
  }
});

export { router as proxyRouter };
