import { Router } from "express";
import { v4 as uuid } from "uuid";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { workflows, workflowRuns, workflowStepRuns } from "../db/schema.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { executeWorkflow } from "./engine.js";
import { auditFromReq } from "../audit/logger.js";

const router = Router();
router.use(requireAuth);

// List workflows
router.get("/", async (_req, res) => {
  try {
    const all = db.select().from(workflows).orderBy(desc(workflows.updatedAt)).all();
    res.json(all);
  } catch (err) {
    console.error("Failed to list workflows:", err);
    res.status(500).json({ error: "Failed to list workflows" });
  }
});

// Create workflow
router.post("/", requireRole("canManageAgents"), async (req, res) => {
  try {
    const { name, description, definition } = req.body;
    if (!name || !definition) return res.status(400).json({ error: "name and definition required" });
    const id = uuid();
    const now = new Date().toISOString();
    db.insert(workflows).values({
      id, name, description: description || null,
      definition: typeof definition === "string" ? definition : JSON.stringify(definition),
      status: "draft", createdBy: req.user!.id,
      createdAt: now, updatedAt: now,
    }).run();
    auditFromReq(req, "workflow.create", { type: "workflow", id }, { name });
    const wf = db.select().from(workflows).where(eq(workflows.id, id)).get();
    res.status(201).json(wf);
  } catch (err) {
    console.error("Failed to create workflow:", err);
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

// --- Run routes (must be before /:id to avoid shadowing) ---

// List runs
router.get("/runs/list", async (req, res) => {
  try {
    const { workflowId } = req.query;
    let runs;
    if (workflowId) {
      runs = db.select().from(workflowRuns).where(eq(workflowRuns.workflowId, workflowId as string)).orderBy(desc(workflowRuns.startedAt)).all();
    } else {
      runs = db.select().from(workflowRuns).orderBy(desc(workflowRuns.startedAt)).limit(50).all();
    }
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: "Failed to list runs" });
  }
});

// Get run details with steps
router.get("/runs/:runId", async (req, res) => {
  try {
    const run = db.select().from(workflowRuns).where(eq(workflowRuns.id, req.params.runId)).get();
    if (!run) return res.status(404).json({ error: "Run not found" });
    const steps = db.select().from(workflowStepRuns).where(eq(workflowStepRuns.runId, req.params.runId)).all();
    res.json({ ...run, steps });
  } catch (err) {
    res.status(500).json({ error: "Failed to get run" });
  }
});

// Cancel run
router.post("/runs/:runId/cancel", requireRole("canExecuteTasks"), async (req, res) => {
  try {
    const run = db.select().from(workflowRuns).where(eq(workflowRuns.id, req.params.runId)).get();
    if (!run) return res.status(404).json({ error: "Run not found" });
    db.update(workflowRuns).set({
      status: "cancelled", completedAt: new Date().toISOString(),
    }).where(eq(workflowRuns.id, req.params.runId)).run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel run" });
  }
});

// --- Workflow CRUD by ID ---

// Get workflow
router.get("/:id", async (req, res) => {
  try {
    const wf = db.select().from(workflows).where(eq(workflows.id, req.params.id)).get();
    if (!wf) return res.status(404).json({ error: "Workflow not found" });
    res.json(wf);
  } catch (err) {
    res.status(500).json({ error: "Failed to get workflow" });
  }
});

// Update workflow
router.put("/:id", requireRole("canManageAgents"), async (req, res) => {
  try {
    const existing = db.select().from(workflows).where(eq(workflows.id, req.params.id)).get();
    if (!existing) return res.status(404).json({ error: "Workflow not found" });
    const { name, description, definition, status } = req.body;
    db.update(workflows).set({
      name: name ?? existing.name,
      description: description !== undefined ? description : existing.description,
      definition: definition ? (typeof definition === "string" ? definition : JSON.stringify(definition)) : existing.definition,
      status: status ?? existing.status,
      updatedAt: new Date().toISOString(),
    }).where(eq(workflows.id, req.params.id)).run();
    const updated = db.select().from(workflows).where(eq(workflows.id, req.params.id)).get();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

// Delete workflow
router.delete("/:id", requireRole("canManageAgents"), async (req, res) => {
  try {
    const existing = db.select().from(workflows).where(eq(workflows.id, req.params.id)).get();
    if (!existing) return res.status(404).json({ error: "Workflow not found" });
    db.delete(workflows).where(eq(workflows.id, req.params.id)).run();
    auditFromReq(req, "workflow.delete", { type: "workflow", id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete workflow" });
  }
});

// Run workflow
router.post("/:id/run", requireRole("canExecuteTasks"), async (req, res) => {
  try {
    const wf = db.select().from(workflows).where(eq(workflows.id, req.params.id)).get();
    if (!wf) return res.status(404).json({ error: "Workflow not found" });

    const runId = uuid();
    db.insert(workflowRuns).values({
      id: runId, workflowId: wf.id, status: "running",
      input: req.body.input ? JSON.stringify(req.body.input) : null,
      startedAt: new Date().toISOString(),
      createdBy: req.user!.id,
    }).run();

    auditFromReq(req, "workflow.run", { type: "workflow", id: wf.id }, { runId });

    // Execute asynchronously
    executeWorkflow(runId).catch(err => {
      console.error("Workflow execution failed:", err);
      db.update(workflowRuns).set({
        status: "failed", completedAt: new Date().toISOString(),
      }).where(eq(workflowRuns.id, runId)).run();
    });

    res.status(201).json({ runId });
  } catch (err) {
    res.status(500).json({ error: "Failed to start workflow" });
  }
});

export { router as workflowsRouter };
