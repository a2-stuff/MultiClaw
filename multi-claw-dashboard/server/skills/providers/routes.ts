import { Router } from "express";
import { db } from "../../db/index.js";
import { skillProviders } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../auth/middleware.js";
import { getProviderByType } from "./index.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const providers = db.select().from(skillProviders).all();
  res.json(providers.filter((p) => p.enabled));
});

router.get("/:id/search", async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== "string") return res.status(400).json({ error: "query parameter q required" });
  const dbProvider = db.select().from(skillProviders).where(eq(skillProviders.id, req.params.id as string)).get();
  if (!dbProvider) return res.status(404).json({ error: "Provider not found" });
  const provider = getProviderByType(dbProvider.type, dbProvider.apiBaseUrl);
  if (!provider) return res.status(404).json({ error: "Provider implementation not found" });
  try {
    const results = await provider.search(q);
    res.json({ results, provider: { id: dbProvider.id, name: dbProvider.name, type: dbProvider.type } });
  } catch (err: any) {
    console.error("Skill search error:", err);
    res.status(502).json({ error: "Search failed" });
  }
});

export { router as skillProvidersRouter };
