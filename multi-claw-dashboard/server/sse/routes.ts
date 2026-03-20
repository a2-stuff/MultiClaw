import { Router } from "express";
import { v4 as uuid } from "uuid";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { sseManager } from "./manager.js";
import type { AuthUser } from "../auth/middleware.js";

const router = Router();

router.get("/", (req, res) => {
  // Prefer Authorization header, fall back to query param for EventSource compatibility
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else {
    token = req.query.token as string;
  }
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const user = jwt.verify(token, config.jwtSecret) as AuthUser;
    const clientId = uuid();
    sseManager.addClient(clientId, user.id, res);
  } catch { return res.status(401).json({ error: "Invalid token" }); }
});

export { router as sseRouter };
