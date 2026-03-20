import { Router } from "express";
import { desc, eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditLogs } from "../db/schema.js";
import { requireAuth, requireRole } from "../auth/middleware.js";

const router = Router();
router.use(requireAuth);
router.use(requireRole("canManageUsers")); // Admin-only

// List audit logs with filters
router.get("/", async (req, res) => {
  try {
    const { actor, action, targetType, from, to, limit: limitStr, offset: offsetStr } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);
    const offset = parseInt(offsetStr as string) || 0;

    let query = db.select().from(auditLogs);
    const conditions: any[] = [];

    if (actor) conditions.push(eq(auditLogs.actorId, actor as string));
    if (action) conditions.push(eq(auditLogs.action, action as string));
    if (targetType) conditions.push(eq(auditLogs.targetType, targetType as string));
    if (from) conditions.push(gte(auditLogs.timestamp, from as string));
    if (to) conditions.push(lte(auditLogs.timestamp, to as string));

    const results = conditions.length > 0
      ? db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.timestamp)).limit(limit).offset(offset).all()
      : db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(limit).offset(offset).all();

    const total = conditions.length > 0
      ? db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(and(...conditions)).get()?.count || 0
      : db.select({ count: sql<number>`count(*)` }).from(auditLogs).get()?.count || 0;

    res.json({ logs: results, total, limit, offset });
  } catch (err) {
    console.error("Failed to list audit logs:", err);
    res.status(500).json({ error: "Failed to list audit logs" });
  }
});

// Export as CSV
router.get("/export", async (req, res) => {
  try {
    const { from, to } = req.query;
    const conditions: any[] = [];
    if (from) conditions.push(gte(auditLogs.timestamp, from as string));
    if (to) conditions.push(lte(auditLogs.timestamp, to as string));

    const results = conditions.length > 0
      ? db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.timestamp)).all()
      : db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).all();

    const header = "timestamp,actor_type,actor_id,action,target_type,target_id,ip_address,metadata\n";
    const rows = results.map(r =>
      [r.timestamp, r.actorType, r.actorId || "", r.action, r.targetType || "", r.targetId || "", r.ipAddress || "", (r.metadata || "").replace(/"/g, '""')]
        .map(v => `"${v}"`).join(",")
    ).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(header + rows);
  } catch (err) {
    console.error("Failed to export audit logs:", err);
    res.status(500).json({ error: "Failed to export audit logs" });
  }
});

export { router as auditRouter };
