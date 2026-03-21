import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { runOrchestration, runDashboardQuery, getOrchestration, listOrchestrations } from "./orchestrator.js";

const router = Router();
router.use(requireAuth);

// Dashboard answers directly (no agents tagged)
router.post("/ask", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt required" });
    const orchId = await runDashboardQuery(prompt, req.user!.id);
    res.json({ orchestrationId: orchId, mode: "dashboard", status: "running" });
  } catch (err: any) {
    console.error("Dashboard query error:", err);
    res.status(500).json({ error: err.message || "Dashboard query failed" });
  }
});

// Dispatch to agents (1 = direct, 2+ = parallel)
router.post("/dispatch", async (req, res) => {
  try {
    const { prompt, agentIds } = req.body;
    if (!prompt || !agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({ error: "prompt and agentIds[] required" });
    }
    const orchId = await runOrchestration(prompt, agentIds, req.user!.id);
    const mode = agentIds.length === 1 ? "direct" : "parallel";
    res.json({ orchestrationId: orchId, mode, status: "running" });
  } catch (err: any) {
    console.error("Task dispatch error:", err);
    res.status(500).json({ error: "Task dispatch failed" });
  }
});

router.get("/:id", async (req, res) => {
  const orch = getOrchestration(req.params.id);
  if (!orch) return res.status(404).json({ error: "Not found" });
  res.json(orch);
});

router.get("/", async (_req, res) => {
  res.json(listOrchestrations());
});

export { router as taskDispatchRouter };
