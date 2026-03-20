import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents } from "../db/schema.js";
import { requireAuth } from "../auth/middleware.js";
import { sseManager } from "../sse/manager.js";
import { wsManager } from "../ws/manager.js";
import { resolveAgentUrl } from "../tailscale/helpers.js";

const router = Router();
router.use(requireAuth);

router.post("/:fromAgentId/message/:toAgentId", async (req, res) => {
  try {
    const { fromAgentId, toAgentId } = req.params;
    const { payload } = req.body;
    const toAgent = db.select().from(agents).where(eq(agents.id, toAgentId)).get();
    if (!toAgent) return res.status(404).json({ error: "Target agent not found" });
    const resp = await fetch(`${resolveAgentUrl(toAgent)}/api/message`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": toAgent.apiKey },
      body: JSON.stringify({ from_agent_id: fromAgentId, payload }),
    });
    if (!resp.ok) return res.status(502).json({ error: "Failed to deliver message" });
    const result = await resp.json();
    sseManager.broadcast("agent_message", { from: fromAgentId, to: toAgentId, timestamp: new Date().toISOString() });
    wsManager.broadcast("agent_message", { from: fromAgentId, to: toAgentId, timestamp: new Date().toISOString() });
    res.json({ delivered: true, result });
  } catch { res.status(500).json({ error: "Message relay failed" }); }
});

router.post("/broadcast", async (req, res) => {
  const { payload } = req.body;
  const allAgents = db.select().from(agents).all();
  const results = [];
  for (const agent of allAgents) {
    try {
      const resp = await fetch(`${resolveAgentUrl(agent)}/api/message`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": agent.apiKey },
        body: JSON.stringify({ from_agent_id: "dashboard", payload }),
      });
      results.push({ agentId: agent.id, success: resp.ok });
    } catch { results.push({ agentId: agent.id, success: false }); }
  }
  res.json({ results });
});

export { router as relayRouter };
