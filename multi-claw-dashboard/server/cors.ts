// multi-claw-dashboard/server/cors.ts
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { settings } from "./db/schema.js";
import { config } from "./config.js";
import { requireAuth, requireRole } from "./auth/middleware.js";

const SETTINGS_KEY = "cors_origins";
const MAX_CUSTOM_ORIGINS = 500;

// Protected origins from .env — immutable at runtime
const protectedOrigins: string[] = [...config.corsOrigins];

// Live set used by CORS middleware
let dynamicOrigins = new Set<string>(protectedOrigins);

const ORIGIN_REGEX = /^https?:\/\/(\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+)(:\d{1,5})?$/;

export function validateOrigin(origin: string): string | null {
  const trimmed = origin.trim();
  if (!trimmed) return "Origin cannot be empty";
  if (trimmed.endsWith("/")) return "Origin must not end with a trailing slash";
  if (!ORIGIN_REGEX.test(trimmed)) return "Must be a valid http:// or https:// URL with IP or domain";
  return null;
}

export function isOriginAllowed(origin: string): boolean {
  return dynamicOrigins.has(origin);
}

function readCustomOrigins(): string[] {
  const row = db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).get();
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCustomOrigins(origins: string[]): void {
  const value = JSON.stringify(origins);
  const existing = db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).get();
  if (existing) {
    db.update(settings)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(settings.key, SETTINGS_KEY))
      .run();
  } else {
    db.insert(settings).values({ key: SETTINGS_KEY, value }).run();
  }
}

function rebuild(): void {
  const custom = readCustomOrigins();
  dynamicOrigins = new Set([...protectedOrigins, ...custom]);
}

export function loadCorsOrigins(): void {
  rebuild();
}

export function getCorsOrigins(): { protected: string[]; custom: string[] } {
  return { protected: [...protectedOrigins], custom: readCustomOrigins() };
}

export function addCorsOrigin(origin: string): { error?: string } {
  const err = validateOrigin(origin);
  if (err) return { error: err };
  const trimmed = origin.trim();

  // Transaction to avoid read-modify-write races
  const result: { error?: string } = db.transaction((tx) => {
    void tx;
    const custom = readCustomOrigins();
    if (custom.includes(trimmed) || protectedOrigins.includes(trimmed)) {
      return {}; // Already exists — no-op
    }
    if (custom.length >= MAX_CUSTOM_ORIGINS) {
      return { error: `Maximum of ${MAX_CUSTOM_ORIGINS} custom origins reached` };
    }
    custom.push(trimmed);
    writeCustomOrigins(custom);
    return {};
  });
  if (!result.error) rebuild();
  return result;
}

export function removeCorsOrigin(origin: string): { error?: string } {
  const trimmed = origin.trim();
  if (protectedOrigins.includes(trimmed)) {
    return { error: "Cannot remove a protected origin" };
  }

  // Transaction to avoid read-modify-write races
  const result: { error?: string } = db.transaction((tx) => {
    void tx;
    const custom = readCustomOrigins();
    const filtered = custom.filter((o) => o !== trimmed);
    if (filtered.length === custom.length) {
      return { error: "Origin not found" };
    }
    writeCustomOrigins(filtered);
    return {};
  });
  if (!result.error) rebuild();
  return result;
}

// --- Express Router ---

const router = Router();
router.use(requireAuth);

router.get("/", requireRole("canManageUsers"), (_req, res) => {
  res.json(getCorsOrigins());
});

router.post("/", requireRole("canManageUsers"), (req, res) => {
  const { origin } = req.body;
  if (!origin || typeof origin !== "string") {
    return res.status(400).json({ error: "origin is required" });
  }
  const result = addCorsOrigin(origin);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(getCorsOrigins());
});

router.delete("/", requireRole("canManageUsers"), (req, res) => {
  const { origin } = req.body;
  if (!origin || typeof origin !== "string") {
    return res.status(400).json({ error: "origin is required" });
  }
  const result = removeCorsOrigin(origin);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(getCorsOrigins());
});

export { router as corsRouter };
