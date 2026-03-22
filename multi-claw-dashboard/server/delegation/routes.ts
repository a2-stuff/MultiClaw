import { Router } from "express";
import { v4 as uuid } from "uuid";
import { eq, and, desc, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents, agentTasks, agentPermissions, delegations } from "../db/schema.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { issuePeerToken } from "./peer-token.js";
import { auditFromReq } from "../audit/logger.js";

const router = Router();
router.use(requireAuth);

// === Permissions Management ===

// List all permissions
router.get("/permissions", async (_req, res) => {
  try {
    const perms = db.select().from(agentPermissions).all();
    res.json(perms);
  } catch (err) {
    console.error("Failed to list permissions:", err);
    res.status(500).json({ error: "Failed to list permissions" });
  }
});

// Create permission
router.post("/permissions", requireRole("canManageAgents"), async (req, res) => {
  try {
    const { fromAgentId, toAgentId, canDelegate, canQuery } = req.body;
    if (!fromAgentId || !toAgentId) return res.status(400).json({ error: "fromAgentId and toAgentId required" });
    if (fromAgentId === toAgentId) return res.status(400).json({ error: "Cannot create self-permission" });

    // Check agents exist
    const fromAgent = db.select().from(agents).where(eq(agents.id, fromAgentId)).get();
    const toAgent = db.select().from(agents).where(eq(agents.id, toAgentId)).get();
    if (!fromAgent || !toAgent) return res.status(404).json({ error: "One or both agents not found" });

    // Check for existing permission
    const existing = db.select().from(agentPermissions)
      .where(and(eq(agentPermissions.fromAgentId, fromAgentId), eq(agentPermissions.toAgentId, toAgentId))).get();
    if (existing) return res.status(409).json({ error: "Permission already exists" });

    const id = uuid();
    const now = new Date().toISOString();
    db.insert(agentPermissions).values({
      id, fromAgentId, toAgentId,
      canDelegate: canDelegate !== false,
      canQuery: canQuery !== false,
      createdBy: req.user!.id,
      createdAt: now, updatedAt: now,
    }).run();
    auditFromReq(req, "permission.create", { type: "permission", id }, { fromAgentId, toAgentId });
    const perm = db.select().from(agentPermissions).where(eq(agentPermissions.id, id)).get();
    res.status(201).json(perm);
  } catch (err) {
    console.error("Failed to create permission:", err);
    res.status(500).json({ error: "Failed to create permission" });
  }
});

// Delete permission
router.delete("/permissions/:id", requireRole("canManageAgents"), async (req, res) => {
  try {
    const permId = req.params.id as string;
    const existing = db.select().from(agentPermissions).where(eq(agentPermissions.id, permId)).get();
    if (!existing) return res.status(404).json({ error: "Permission not found" });
    db.delete(agentPermissions).where(eq(agentPermissions.id, permId)).run();
    auditFromReq(req, "permission.delete", { type: "permission", id: permId });
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete permission:", err);
    res.status(500).json({ error: "Failed to delete permission" });
  }
});

// === Delegation ===

// Create delegation (orchestrated mode — dashboard routes the task)
router.post("/delegate", requireRole("canExecuteTasks"), async (req, res) => {
  try {
    const { fromAgentId, toAgentId, prompt } = req.body;
    if (!fromAgentId || !toAgentId || !prompt) {
      return res.status(400).json({ error: "fromAgentId, toAgentId, and prompt required" });
    }

    // Check permission
    const perm = db.select().from(agentPermissions)
      .where(and(eq(agentPermissions.fromAgentId, fromAgentId), eq(agentPermissions.toAgentId, toAgentId))).get();
    if (!perm || !perm.canDelegate) {
      return res.status(403).json({ error: "Agent does not have delegation permission" });
    }

    // Create the task for the target agent
    const taskId = uuid();
    const now = new Date().toISOString();
    db.insert(agentTasks).values({
      id: taskId, agentId: toAgentId, prompt, status: "queued",
      createdBy: req.user!.id, createdAt: now,
    }).run();

    // Create delegation record
    const delegationId = uuid();
    db.insert(delegations).values({
      id: delegationId, fromAgentId, toAgentId, taskId,
      mode: "orchestrated", status: "pending",
      createdAt: now, updatedAt: now,
    }).run();

    auditFromReq(req, "delegation.create", { type: "delegation", id: delegationId }, { fromAgentId, toAgentId, mode: "orchestrated" });
    res.status(201).json({ delegationId, taskId });
  } catch (err) {
    console.error("Failed to create delegation:", err);
    res.status(500).json({ error: "Failed to create delegation" });
  }
});

// Get agent endpoint for direct comms (issues peer token)
router.get("/agents/:id/endpoint", async (req, res) => {
  try {
    const fromAgentId = req.query.fromAgentId as string;
    if (!fromAgentId) return res.status(400).json({ error: "fromAgentId query param required" });

    const toAgentId = req.params.id as string;
    const perm = db.select().from(agentPermissions)
      .where(and(eq(agentPermissions.fromAgentId, fromAgentId), eq(agentPermissions.toAgentId, toAgentId))).get();
    if (!perm) return res.status(403).json({ error: "No permission for this agent pair" });

    const agent = db.select({ url: agents.url }).from(agents).where(eq(agents.id, toAgentId)).get();
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const peerToken = issuePeerToken(fromAgentId, toAgentId);
    res.json({ url: agent.url, peerToken, expiresIn: 300 });
  } catch (err) {
    console.error("Failed to get agent endpoint:", err);
    res.status(500).json({ error: "Failed to get agent endpoint" });
  }
});

// List delegations with filters
router.get("/delegations", async (req, res) => {
  try {
    const { agentId, status: statusFilter, limit: limitStr } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);

    let results;
    if (agentId) {
      results = db.select().from(delegations)
        .where(or(eq(delegations.fromAgentId, agentId as string), eq(delegations.toAgentId, agentId as string)))
        .orderBy(desc(delegations.createdAt)).limit(limit).all();
    } else {
      results = db.select().from(delegations)
        .orderBy(desc(delegations.createdAt)).limit(limit).all();
    }
    res.json(results);
  } catch (err) {
    console.error("Failed to list delegations:", err);
    res.status(500).json({ error: "Failed to list delegations" });
  }
});

export { router as delegationRouter };
