import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { settings } from "../db/schema.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { auditFromReq } from "../audit/logger.js";

const router = Router();
router.use(requireAuth);

router.get("/", requireRole("canManageUsers"), async (_req, res) => {
  const all = db.select().from(settings).all();
  const masked = all.map((s) => ({
    key: s.key,
    value: s.key.includes("key") ? (s.value ? "••••••" + s.value.slice(-6) : "") : s.value,
    hasValue: !!s.value,
    updatedAt: s.updatedAt,
  }));
  res.json(masked);
});

const ALLOWED_SETTINGS_KEYS = new Set([
  "anthropic_api_key",
  "openai_api_key",
  "google_api_key",
  "openrouter_api_key",
  "deepseek_api_key",
  "default_provider",
  "default_model",
  "dashboard_profile",
]);

router.put("/:key", requireRole("canManageUsers"), async (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_SETTINGS_KEYS.has(key)) {
    return res.status(400).json({ error: "Unknown settings key" });
  }
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: "value required" });
  if (typeof value !== "string" || value.length > 4096) {
    return res.status(400).json({ error: "Invalid value" });
  }

  const existing = db.select().from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    db.update(settings)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(settings.key, key))
      .run();
  } else {
    db.insert(settings).values({ key, value }).run();
  }

  auditFromReq(req, "settings.update", { type: "setting", id: req.params.key });

  if (key.endsWith("_api_key")) {
    const { syncConfigToAllAgents } = await import("../agents/config-sync.js");
    await syncConfigToAllAgents();
  }

  res.json({ success: true });
});

router.delete("/:key", requireRole("canManageUsers"), async (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_SETTINGS_KEYS.has(key)) {
    return res.status(400).json({ error: "Unknown settings key" });
  }
  db.delete(settings).where(eq(settings.key, key)).run();
  auditFromReq(req, "settings.delete", { type: "setting", id: req.params.key });
  res.json({ success: true });
});

export { router as settingsRouter };
