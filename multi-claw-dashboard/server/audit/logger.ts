import { v4 as uuid } from "uuid";
import { db } from "../db/index.js";
import { auditLogs } from "../db/schema.js";
import type { Request } from "express";

interface AuditEntry {
  actorType: "user" | "agent" | "system";
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export function auditLog(entry: AuditEntry) {
  try {
    db.insert(auditLogs).values({
      id: uuid(),
      timestamp: new Date().toISOString(),
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType || null,
      targetId: entry.targetId || null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      ipAddress: entry.ipAddress || null,
    }).run();
  } catch (err) {
    console.error("Audit log write failed:", err);
    // Never throw — audit logging should not break the request
  }
}

/**
 * Convenience: extract audit context from an Express request.
 */
export function auditFromReq(req: Request, action: string, target?: { type: string; id: string }, metadata?: Record<string, unknown>) {
  auditLog({
    actorType: "user",
    actorId: req.user?.id || null,
    action,
    targetType: target?.type,
    targetId: target?.id,
    metadata,
    ipAddress: req.ip || req.socket.remoteAddress,
  });
}
