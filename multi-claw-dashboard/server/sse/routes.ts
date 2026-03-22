import { Router } from "express";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { sseManager } from "./manager.js";
import { requireAuth } from "../auth/middleware.js";
import type { AuthUser } from "../auth/middleware.js";

const router = Router();

const sseTickets = new Map<string, { userId: string; expiresAt: number }>();

// Clean up expired tickets periodically
setInterval(() => {
  const now = Date.now();
  for (const [ticket, data] of sseTickets) {
    if (data.expiresAt < now) sseTickets.delete(ticket);
  }
}, 60_000);

router.post("/ticket", requireAuth, (req: any, res) => {
  const ticket = crypto.randomBytes(32).toString("hex");
  sseTickets.set(ticket, {
    userId: req.user.id,
    expiresAt: Date.now() + 30_000, // 30 second TTL
  });
  res.json({ ticket });
});

router.get("/", (req, res) => {
  // Check for single-use ticket first
  const ticketParam = req.query.ticket as string;
  if (ticketParam) {
    const ticketData = sseTickets.get(ticketParam);
    if (!ticketData) return res.status(401).json({ error: "Invalid or expired ticket" });
    if (ticketData.expiresAt < Date.now()) {
      sseTickets.delete(ticketParam);
      return res.status(401).json({ error: "Ticket expired" });
    }
    sseTickets.delete(ticketParam); // single-use
    const clientId = uuid();
    sseManager.addClient(clientId, ticketData.userId, res);
    return;
  }

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
