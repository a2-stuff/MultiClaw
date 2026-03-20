import { Router } from "express";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiKeys, agents } from "../db/schema.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { auditFromReq } from "../audit/logger.js";

const router = Router();
router.use(requireAuth);
router.use(requireRole("canManageAgents"));

// List all API keys (masked)
router.get("/", async (_req, res) => {
  const allKeys = db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      agentId: apiKeys.agentId,
      status: apiKeys.status,
      lastUsedAt: apiKeys.lastUsedAt,
      createdBy: apiKeys.createdBy,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .all();

  // Enrich with agent names
  const enriched = allKeys.map((k) => {
    const agent = k.agentId
      ? db
          .select({ name: agents.name })
          .from(agents)
          .where(eq(agents.id, k.agentId))
          .get()
      : null;
    return {
      ...k,
      agentName: agent?.name || null,
    };
  });

  res.json(enriched);
});

// Create a new API key
router.post("/", async (req, res) => {
  const { name, agentId } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });

  // Validate agent exists if provided
  if (agentId) {
    const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
    if (!agent) return res.status(404).json({ error: "Agent not found" });
  }

  const id = uuid();
  const rawKey = `mck_${crypto.randomBytes(32).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  db.insert(apiKeys)
    .values({
      id,
      name,
      keyHash,
      keyPrefix,
      agentId: agentId || null,
      createdBy: req.user!.id,
    })
    .run();

  auditFromReq(req, "key.create", { type: "key", id }, { name, agentId });

  // Return the full key ONCE — it won't be shown again
  res.status(201).json({
    id,
    name,
    key: rawKey,
    keyPrefix,
    agentId,
    status: "active",
  });
});

// Revoke a key
router.patch("/:id/revoke", async (req, res) => {
  const key = db.select().from(apiKeys).where(eq(apiKeys.id, req.params.id)).get();
  if (!key) return res.status(404).json({ error: "Key not found" });
  if (key.status === "revoked") return res.status(400).json({ error: "Already revoked" });

  db.update(apiKeys)
    .set({ status: "revoked", revokedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, req.params.id))
    .run();

  auditFromReq(req, "key.revoke", { type: "key", id: req.params.id }, { name: key.name });
  res.json({ success: true });
});

// Reactivate a revoked key
router.patch("/:id/activate", async (req, res) => {
  const key = db.select().from(apiKeys).where(eq(apiKeys.id, req.params.id)).get();
  if (!key) return res.status(404).json({ error: "Key not found" });
  if (key.status === "active") return res.status(400).json({ error: "Already active" });

  db.update(apiKeys)
    .set({ status: "active", revokedAt: null })
    .where(eq(apiKeys.id, req.params.id))
    .run();

  res.json({ success: true });
});

// Delete a key permanently
router.delete("/:id", async (req, res) => {
  db.delete(apiKeys).where(eq(apiKeys.id, req.params.id)).run();
  auditFromReq(req, "key.delete", { type: "key", id: req.params.id });
  res.json({ success: true });
});

// Record key usage (called internally by auth middleware)
export function recordKeyUsage(keyId: string) {
  db.update(apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, keyId))
    .run();
}

export { router as keysRouter };
