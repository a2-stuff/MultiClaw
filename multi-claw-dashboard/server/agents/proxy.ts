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
    const agentUrl = resolveAgentUrl(agent);
    const resp = await fetch(`${agentUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": agent.apiKey },
      body: JSON.stringify(req.body),
    });
    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "");
      return res.status(resp.status).json({ error: errorText || `Agent returned ${resp.status}` });
    }
    const result = await resp.json();
    const id = uuid();
    db.insert(agentTasks).values({
      id, agentId: agent.id, prompt: req.body.prompt, status: "running", agentTaskId: result.task_id || null, createdBy: req.user!.id,
    }).run();
    res.json(result);

    // Fire-and-forget: poll agent for task completion and update DB
    if (result.task_id) {
      pollAndUpdate(agentUrl, agent.apiKey, result.task_id, id).catch((err) => {
        console.error("Task poll error:", err.message);
      });
    }
  } catch (err: any) {
    console.error("Agent proxy error:", err);
    res.status(502).json({ error: err.message || "Failed to reach agent" });
  }
});

async function pollAndUpdate(agentUrl: string, apiKey: string, agentTaskId: string, dbTaskId: string) {
  const maxWait = 600_000;  // 10 minutes for long-running tasks (browser, SEO analysis, etc.)
  const interval = 2_000;
  let waited = 0;

  while (waited < maxWait) {
    try {
      const resp = await fetch(`${agentUrl}/api/tasks/${agentTaskId}`, {
        headers: { "X-API-Key": apiKey },
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.status === "completed") {
          db.update(agentTasks)
            .set({ status: "completed", result: data.result || "", completedAt: new Date().toISOString() })
            .where(eq(agentTasks.id, dbTaskId))
            .run();
          return;
        }
        if (data.status === "failed") {
          db.update(agentTasks)
            .set({ status: "failed", error: data.error || "Task failed", completedAt: new Date().toISOString() })
            .where(eq(agentTasks.id, dbTaskId))
            .run();
          return;
        }
      }
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch failed") && !err.message.includes("ECONNREFUSED")) {
        db.update(agentTasks)
          .set({ status: "failed", error: err.message, completedAt: new Date().toISOString() })
          .where(eq(agentTasks.id, dbTaskId))
          .run();
        return;
      }
    }
    await new Promise((r) => setTimeout(r, interval));
    waited += interval;
  }

  db.update(agentTasks)
    .set({ status: "failed", error: "Task timed out after 10 minutes", completedAt: new Date().toISOString() })
    .where(eq(agentTasks.id, dbTaskId))
    .run();
}

router.get("/:agentId/tasks", async (req, res) => {
  const tasks = db.select().from(agentTasks).where(eq(agentTasks.agentId, req.params.agentId)).all();
  res.json(tasks);
});

router.delete("/:agentId/tasks/:taskId", requireRole("canManageAgents"), async (req, res) => {
  const task = db.select().from(agentTasks).where(
    and(eq(agentTasks.id, req.params.taskId), eq(agentTasks.agentId, req.params.agentId))
  ).get();
  if (!task) return res.status(404).json({ error: "Task not found" });
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

router.delete("/:agentId/logs", requireRole("canManageAgents"), async (req, res) => {
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

router.post("/:agentId/self-update", requireRole("canManageAgents"), async (req, res) => {
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

router.post("/:agentId/restart", requireRole("canManageAgents"), async (req, res) => {
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
