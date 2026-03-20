import { Router } from "express";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { agentTemplates } from "../db/schema.js";
import { requireAuth, requireRole } from "../auth/middleware.js";

const router = Router();
router.use(requireAuth);

// List all templates
router.get("/", async (_req, res) => {
  try {
    const templates = db.select().from(agentTemplates).all();
    res.json(templates);
  } catch (err) {
    console.error("Failed to list templates:", err);
    res.status(500).json({ error: "Failed to list templates" });
  }
});

// Get single template
router.get("/:id", async (req, res) => {
  try {
    const template = db.select().from(agentTemplates).where(eq(agentTemplates.id, req.params.id)).get();
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (err) {
    console.error("Failed to get template:", err);
    res.status(500).json({ error: "Failed to get template" });
  }
});

// Create template
router.post("/", requireRole("canManageAgents"), async (req, res) => {
  try {
    const { name, description, provider, model, systemPrompt, skills, plugins, envVars } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const id = uuid();
    const now = new Date().toISOString();
    db.insert(agentTemplates).values({
      id,
      name,
      description: description || null,
      provider: provider || null,
      model: model || null,
      systemPrompt: systemPrompt || null,
      skills: skills ? JSON.stringify(skills) : null,
      plugins: plugins ? JSON.stringify(plugins) : null,
      envVars: envVars ? JSON.stringify(envVars) : null,
      createdBy: req.user!.id,
      createdAt: now,
      updatedAt: now,
    }).run();
    const template = db.select().from(agentTemplates).where(eq(agentTemplates.id, id)).get();
    res.status(201).json(template);
  } catch (err: any) {
    if (err?.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "A template with that name already exists" });
    }
    console.error("Failed to create template:", err);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// Update template
router.put("/:id", requireRole("canManageAgents"), async (req, res) => {
  try {
    const existing = db.select().from(agentTemplates).where(eq(agentTemplates.id, req.params.id)).get();
    if (!existing) return res.status(404).json({ error: "Template not found" });
    const { name, description, provider, model, systemPrompt, skills, plugins, envVars } = req.body;
    db.update(agentTemplates).set({
      name: name ?? existing.name,
      description: description !== undefined ? description : existing.description,
      provider: provider !== undefined ? provider : existing.provider,
      model: model !== undefined ? model : existing.model,
      systemPrompt: systemPrompt !== undefined ? systemPrompt : existing.systemPrompt,
      skills: skills !== undefined ? JSON.stringify(skills) : existing.skills,
      plugins: plugins !== undefined ? JSON.stringify(plugins) : existing.plugins,
      envVars: envVars !== undefined ? JSON.stringify(envVars) : existing.envVars,
      updatedAt: new Date().toISOString(),
    }).where(eq(agentTemplates.id, req.params.id)).run();
    const updated = db.select().from(agentTemplates).where(eq(agentTemplates.id, req.params.id)).get();
    res.json(updated);
  } catch (err: any) {
    if (err?.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "A template with that name already exists" });
    }
    console.error("Failed to update template:", err);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// Delete template
router.delete("/:id", requireRole("canManageAgents"), async (req, res) => {
  try {
    const existing = db.select().from(agentTemplates).where(eq(agentTemplates.id, req.params.id)).get();
    if (!existing) return res.status(404).json({ error: "Template not found" });
    db.delete(agentTemplates).where(eq(agentTemplates.id, req.params.id)).run();
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete template:", err);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// Export template as JSON
router.get("/:id/export", async (req, res) => {
  try {
    const template = db.select().from(agentTemplates).where(eq(agentTemplates.id, req.params.id)).get();
    if (!template) return res.status(404).json({ error: "Template not found" });
    const { id, createdBy, createdAt, updatedAt, ...exportData } = template;
    res.setHeader("Content-Disposition", `attachment; filename="${template.name}.json"`);
    res.json(exportData);
  } catch (err) {
    console.error("Failed to export template:", err);
    res.status(500).json({ error: "Failed to export template" });
  }
});

// Import template from JSON
router.post("/import", requireRole("canManageAgents"), async (req, res) => {
  try {
    const { name, description, provider, model, systemPrompt, skills, plugins, envVars } = req.body;
    if (!name) return res.status(400).json({ error: "Imported template must have a name" });
    const id = uuid();
    const now = new Date().toISOString();
    db.insert(agentTemplates).values({
      id,
      name,
      description: description || null,
      provider: provider || null,
      model: model || null,
      systemPrompt: systemPrompt || null,
      skills: typeof skills === "string" ? skills : skills ? JSON.stringify(skills) : null,
      plugins: typeof plugins === "string" ? plugins : plugins ? JSON.stringify(plugins) : null,
      envVars: typeof envVars === "string" ? envVars : envVars ? JSON.stringify(envVars) : null,
      createdBy: req.user!.id,
      createdAt: now,
      updatedAt: now,
    }).run();
    const template = db.select().from(agentTemplates).where(eq(agentTemplates.id, id)).get();
    res.status(201).json(template);
  } catch (err: any) {
    if (err?.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "A template with that name already exists" });
    }
    console.error("Failed to import template:", err);
    res.status(500).json({ error: "Failed to import template" });
  }
});

export { router as templatesRouter };
