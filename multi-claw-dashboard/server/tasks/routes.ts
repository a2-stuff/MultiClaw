import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { runOrchestration, getOrchestration, listOrchestrations } from "./orchestrator.js";

const router = Router();
router.use(requireAuth);

router.post("/dispatch", async (req, res) => {
  try {
    const { prompt, agentIds } = req.body;
    if (!prompt || !agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({ error: "prompt and agentIds[] required" });
    }
    const orchId = await runOrchestration(prompt, agentIds, req.user!.id);
    res.json({ orchestrationId: orchId, status: "running" });
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
