import { Router } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { db } from "../db/index.js";
import { plugins, agentPlugins } from "../db/schema.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { transferPluginToAgent } from "./transfer.js";
import { eq } from "drizzle-orm";

const upload = multer({
  dest: "uploads/plugins/",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per file
});
const router = Router();
router.use(requireAuth);

router.post("/", requireRole("canManageAgents"), upload.array("files"), async (req, res) => {
  try {
    const { name, description, version, author } = req.body;
    const id = uuid();
    const files = req.files as Express.Multer.File[];
    const fileMap = files.map((f) => ({ originalname: f.originalname, diskPath: f.path }));
    db.insert(plugins).values({
      id, name, description, version: version || "0.1.0", author,
      fileName: JSON.stringify(fileMap),
      fileSize: files.reduce((sum, f) => sum + f.size, 0),
      uploadedBy: req.user!.id,
    }).run();
    res.status(201).json({ id, name });
  } catch (err) { res.status(500).json({ error: "Upload failed" }); }
});

router.get("/", async (_req, res) => {
  const all = db.select().from(plugins).all();
  res.json(all);
});

router.post("/:pluginId/deploy/:agentId", requireRole("canManageAgents"), async (req, res) => {
  const { pluginId, agentId } = req.params;
  const plugin = db.select().from(plugins).where(eq(plugins.id, pluginId)).get();
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });
  const fileMap = JSON.parse(plugin.fileName) as { originalname: string; diskPath: string }[];
  const result = await transferPluginToAgent(
    agentId, { name: plugin.name, description: plugin.description, version: plugin.version },
    fileMap.map((f) => ({ originalname: f.originalname, path: f.diskPath }))
  );
  if (result.success) {
    const id = uuid();
    db.insert(agentPlugins).values({ id, agentId, pluginId, status: "installed" }).run();
    res.json({ deployed: true });
  } else { res.status(502).json({ error: result.error }); }
});

export { router as pluginsRouter };
