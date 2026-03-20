import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { skills, agentSkills, skillProviders } from "../db/schema.js";
import { requireAuth } from "../auth/middleware.js";
import { transferSkillToAgent } from "./transfer.js";
import { getProviderForUrl, getProviderByType } from "./providers/index.js";
import { extractZip } from "./zip.js";

const router = Router();
router.use(requireAuth);

// Custom multer storage: uploads/skills/{skillId}/
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const id = (_req as any)._skillId || uuid();
    (_req as any)._skillId = id;
    const dir = path.join("uploads", "skills", id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// Upload custom skill
router.post("/", upload.array("files"), async (req, res) => {
  try {
    const { name, description, version, author } = req.body;
    const id = (req as any)._skillId || uuid();
    const files = req.files as Express.Multer.File[];
    const fileMap = files.map((f) => ({ originalname: f.originalname, diskPath: f.path }));
    db.insert(skills).values({
      id, name, description, version: version || "0.1.0", author,
      source: "custom",
      fileName: JSON.stringify(fileMap),
      fileSize: files.reduce((sum, f) => sum + f.size, 0),
      uploadedBy: req.user!.id,
    }).run();
    res.status(201).json({ id, name });
  } catch (err) { res.status(500).json({ error: "Upload failed" }); }
});

// List all skills
router.get("/", async (_req, res) => {
  const allSkills = db.select().from(skills).all();
  res.json(allSkills);
});

// Import skill from URL or provider
router.post("/import", async (req, res) => {
  try {
    const { url, providerId, slug, name, description } = req.body;
    let providerType: string;
    let resolvedSlug: string;
    let sourceUrl: string | null = null;
    let providerImpl: ReturnType<typeof getProviderByType>;
    let resolvedProviderId: string | null = null;

    if (url) {
      const match = getProviderForUrl(url);
      if (!match) return res.status(400).json({ error: "Could not detect a skill provider for this URL. Supported: ClawHub, skills.sh" });
      providerType = match.providerType;
      resolvedSlug = match.slug;
      providerImpl = match.provider;
      sourceUrl = url;
      const dbProvider = db.select().from(skillProviders).where(eq(skillProviders.type, providerType)).get();
      resolvedProviderId = dbProvider?.id || null;
    } else if (providerId && slug) {
      const dbProvider = db.select().from(skillProviders).where(eq(skillProviders.id, providerId)).get();
      if (!dbProvider) return res.status(404).json({ error: "Provider not found" });
      providerType = dbProvider.type;
      resolvedSlug = slug;
      providerImpl = getProviderByType(dbProvider.type, dbProvider.apiBaseUrl);
      resolvedProviderId = providerId;
    } else {
      return res.status(400).json({ error: "Provide either url or providerId+slug" });
    }

    if (!providerImpl) return res.status(400).json({ error: "Provider implementation not available" });

    // Duplicate check
    const existing = db.select().from(skills)
      .where(and(eq(skills.source, providerType), eq(skills.sourceSlug, resolvedSlug)))
      .get();
    if (existing) return res.json({ skill: existing, alreadyExists: true });

    // Download and extract
    const zipBuffer = await providerImpl.download(resolvedSlug);
    const skillId = uuid();
    const destDir = path.join("uploads", "skills", skillId);
    const extractedFiles = await extractZip(zipBuffer, destDir);

    // Read _meta.json if present
    let version = "unknown";
    const metaFile = extractedFiles.find((f) => f.originalname === "_meta.json");
    if (metaFile) {
      try {
        const metaContent = JSON.parse(fs.readFileSync(metaFile.diskPath, "utf-8"));
        version = metaContent.version || version;
      } catch {}
    }

    // Parse YAML frontmatter from .md files for name/description
    let fmName: string | null = null;
    let fmDesc: string | null = null;
    const mdFile = extractedFiles.find((f) => f.originalname.endsWith(".md"));
    if (mdFile) {
      try {
        const mdContent = fs.readFileSync(mdFile.diskPath, "utf-8");
        const fmMatch = mdContent.match(/^---\s*\n([\s\S]*?)\n---/);
        if (fmMatch) {
          const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
          const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
          if (nameMatch) fmName = nameMatch[1].trim();
          if (descMatch) fmDesc = descMatch[1].trim();
        }
      } catch {}
    }

    // For skills.sh slugs like "owner/repo/skill-name", extract just the skill name
    const displayName = name || fmName || resolvedSlug.split("/").pop() || resolvedSlug;

    const totalSize = extractedFiles.reduce((sum, f) => {
      try { return sum + fs.statSync(f.diskPath).size; } catch { return sum; }
    }, 0);

    db.insert(skills).values({
      id: skillId,
      name: displayName,
      description: description || fmDesc || null,
      version,
      source: providerType,
      sourceUrl,
      sourceSlug: resolvedSlug,
      providerId: resolvedProviderId,
      fileName: JSON.stringify(extractedFiles),
      fileSize: totalSize,
      uploadedBy: req.user!.id,
    }).run();

    const skill = db.select().from(skills).where(eq(skills.id, skillId)).get();
    res.status(201).json({ skill, alreadyExists: false });
  } catch (err: any) {
    console.error("Skill import error:", err.message);
    res.status(500).json({ error: err.message || "Import failed" });
  }
});

// Deploy skill to agent
router.post("/:skillId/deploy/:agentId", async (req, res) => {
  const { skillId, agentId } = req.params;
  const skill = db.select().from(skills).where(eq(skills.id, skillId as string)).get();
  if (!skill) return res.status(404).json({ error: "Skill not found" });
  const fileMap = JSON.parse(skill.fileName) as { originalname: string; diskPath: string }[];
  const metadata: Record<string, any> = {
    name: skill.name, description: skill.description, version: skill.version,
  };
  if (skill.source !== "custom") {
    metadata.skill_type = "instruction";
    metadata.entry_point = null;
  }
  const result = await transferSkillToAgent(
    agentId as string, metadata,
    fileMap.map((f) => ({ originalname: f.originalname, path: f.diskPath }))
  );
  if (result.success) {
    const id = uuid();
    db.insert(agentSkills).values({ id, agentId: agentId as string, skillId: skillId as string, status: "installed" }).run();
    res.json({ deployed: true });
  } else { res.status(502).json({ error: result.error }); }
});

// Delete skill
router.delete("/:id", async (req, res) => {
  const skillId = req.params.id as string;
  const skill = db.select().from(skills).where(eq(skills.id, skillId)).get();
  if (!skill) return res.status(404).json({ error: "Skill not found" });
  db.delete(agentSkills).where(eq(agentSkills.skillId, skillId)).run();
  const skillDir = path.join("uploads", "skills", skillId);
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true });
  }
  db.delete(skills).where(eq(skills.id, skillId)).run();
  res.json({ deleted: true });
});

export { router as skillsRouter };
