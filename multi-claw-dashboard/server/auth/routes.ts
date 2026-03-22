import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { config } from "../config.js";
import { requireAuth } from "./middleware.js";

const router = Router();

router.post("/register", (_req, res) => {
  res.status(403).json({ error: "Registration is disabled. Contact an administrator." });
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.select().from(users).where(eq(users.email, email)).get();
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token });
  } catch { res.status(500).json({ error: "Login failed" }); }
});

router.get("/me", requireAuth, (req, res) => { res.json({ user: req.user }); });

export { router as authRouter };
