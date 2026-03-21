import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { users, agents } from "../db/schema.js";
import { Role, hasPermission, ROLES } from "./roles.js";

export interface AuthUser { id: string; email: string; role: Role; }
export interface AgentIdentity { id: string; name: string; }

declare global {
  namespace Express { interface Request { user?: AuthUser; agent?: AgentIdentity; } }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing authorization header" });
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    const dbUser = db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(eq(users.id, payload.id)).get();
    if (!dbUser) return res.status(401).json({ error: "User no longer exists. Please log in again." });
    req.user = { id: dbUser.id, email: dbUser.email, role: dbUser.role as Role };
    next();
  } catch { return res.status(401).json({ error: "Invalid token" }); }
}

export function requireAuthOrAgent(req: Request, res: Response, next: NextFunction) {
  // First try JWT auth
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(authHeader.slice(7), config.jwtSecret) as AuthUser;
      const dbUser = db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(eq(users.id, payload.id)).get();
      if (dbUser) {
        req.user = { id: dbUser.id, email: dbUser.email, role: dbUser.role as Role };
        return next();
      }
    } catch {
      // JWT failed, fall through to API key check
    }
  }

  // Then try X-API-Key agent auth
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey) {
    return res.status(401).json({ error: "Missing authorization header or API key" });
  }

  const allAgents = db.select({ id: agents.id, name: agents.name, apiKey: agents.apiKey }).from(agents).all();
  const apiKeyBuf = Buffer.from(apiKey);
  const matched = allAgents.find(a => {
    const storedBuf = Buffer.from(a.apiKey);
    if (apiKeyBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(apiKeyBuf, storedBuf);
  });

  if (!matched) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  req.user = { id: matched.id, email: matched.name, role: "agent" as Role };
  req.agent = { id: matched.id, name: matched.name };
  next();
}

type Permission = keyof (typeof ROLES)["admin"];
export function requireRole(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    for (const perm of permissions) {
      if (!hasPermission(req.user.role, perm)) return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
