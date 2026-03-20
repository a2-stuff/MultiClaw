import { Router } from "express";
import { v4 as uuid } from "uuid";
import { eq, and, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { sharedState } from "../db/schema.js";
import { requireAuth } from "../auth/middleware.js";
import { auditFromReq } from "../audit/logger.js";

const router = Router();
router.use(requireAuth);

// List keys in a namespace
router.get("/state/:namespace", async (req, res) => {
  try {
    const entries = db.select({
      id: sharedState.id, key: sharedState.key, version: sharedState.version,
      updatedAt: sharedState.updatedAt, expiresAt: sharedState.expiresAt,
    }).from(sharedState).where(eq(sharedState.namespace, req.params.namespace)).all();
    res.json(entries);
  } catch (err) {
    console.error("Failed to list state:", err);
    res.status(500).json({ error: "Failed to list state" });
  }
});

// Get value
router.get("/state/:namespace/:key", async (req, res) => {
  try {
    const entry = db.select().from(sharedState)
      .where(and(eq(sharedState.namespace, req.params.namespace), eq(sharedState.key, req.params.key))).get();
    if (!entry) return res.status(404).json({ error: "Key not found" });
    // Check expiry
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      db.delete(sharedState).where(eq(sharedState.id, entry.id)).run();
      return res.status(404).json({ error: "Key expired" });
    }
    res.json({ ...entry, value: entry.value ? JSON.parse(entry.value) : null });
  } catch (err) {
    console.error("Failed to get state:", err);
    res.status(500).json({ error: "Failed to get state" });
  }
});

// Set value (create or update with optimistic concurrency)
router.put("/state/:namespace/:key", async (req, res) => {
  try {
    const { value, version, expiresAt } = req.body;
    const { namespace, key } = req.params;
    const existing = db.select().from(sharedState)
      .where(and(eq(sharedState.namespace, namespace), eq(sharedState.key, key))).get();

    if (existing) {
      // Update — check version for optimistic concurrency
      if (version !== undefined && version !== existing.version) {
        return res.status(409).json({ error: "Version conflict", currentVersion: existing.version });
      }
      db.update(sharedState).set({
        value: JSON.stringify(value),
        version: existing.version + 1,
        updatedAt: new Date().toISOString(),
        expiresAt: expiresAt || existing.expiresAt,
      }).where(eq(sharedState.id, existing.id)).run();
      auditFromReq(req, "memory.write", { type: "state", id: existing.id }, { namespace, key });
      const updated = db.select().from(sharedState).where(eq(sharedState.id, existing.id)).get();
      res.json(updated);
    } else {
      // Create
      const id = uuid();
      const now = new Date().toISOString();
      db.insert(sharedState).values({
        id, namespace, key, value: JSON.stringify(value), version: 1,
        createdBy: req.user?.id || null, createdAt: now, updatedAt: now,
        expiresAt: expiresAt || null,
      }).run();
      auditFromReq(req, "memory.write", { type: "state", id }, { namespace, key });
      const created = db.select().from(sharedState).where(eq(sharedState.id, id)).get();
      res.status(201).json(created);
    }
  } catch (err) {
    console.error("Failed to set state:", err);
    res.status(500).json({ error: "Failed to set state" });
  }
});

// Delete value
router.delete("/state/:namespace/:key", async (req, res) => {
  try {
    const entry = db.select().from(sharedState)
      .where(and(eq(sharedState.namespace, req.params.namespace), eq(sharedState.key, req.params.key))).get();
    if (!entry) return res.status(404).json({ error: "Key not found" });
    db.delete(sharedState).where(eq(sharedState.id, entry.id)).run();
    auditFromReq(req, "memory.delete", { type: "state", id: entry.id }, { namespace: req.params.namespace, key: req.params.key });
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete state:", err);
    res.status(500).json({ error: "Failed to delete state" });
  }
});

// Cleanup expired entries (called on interval or manually)
router.post("/state/_cleanup", async (_req, res) => {
  try {
    const now = new Date().toISOString();
    const result = db.delete(sharedState).where(lt(sharedState.expiresAt, now)).run();
    res.json({ deleted: result.changes });
  } catch (err) {
    console.error("Failed to cleanup:", err);
    res.status(500).json({ error: "Cleanup failed" });
  }
});

export { router as stateRouter };
