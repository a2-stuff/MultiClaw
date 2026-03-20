import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { Role, hasPermission, ROLES } from "./roles.js";

export interface AuthUser { id: string; email: string; role: Role; }

declare global {
  namespace Express { interface Request { user?: AuthUser; } }
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
