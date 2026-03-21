import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { config } from "../config.js";
import { requireAuth } from "./middleware.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: "email, password, and name required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    if (password.length > 128) return res.status(400).json({ error: "Password must be 128 characters or less" });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: "Invalid email format" });
    const existing = db.select().from(users).where(eq(users.email, email)).get();
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const id = uuid();
    const passwordHash = await bcrypt.hash(password, 12);
    const role = "viewer";
    db.insert(users).values({ id, email, passwordHash, name, role }).run();
    const token = jwt.sign({ id, email, role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    res.status(201).json({ user: { id, email, name, role }, token });
  } catch (err) { res.status(500).json({ error: "Registration failed" }); }
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
