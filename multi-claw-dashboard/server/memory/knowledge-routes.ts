import { Router } from "express";
import { v4 as uuid } from "uuid";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { knowledgeEntries } from "../db/schema.js";
import { requireAuth } from "../auth/middleware.js";
import { auditFromReq } from "../audit/logger.js";
import { generateEmbedding, cosineSimilarity } from "./embeddings.js";

const router = Router();
router.use(requireAuth);

// Ingest knowledge entry
router.post("/ingest", async (req, res) => {
  try {
    const { content, metadata } = req.body;
    if (!content) return res.status(400).json({ error: "content required" });

    const embedding = await generateEmbedding(content);
    const id = uuid();
    const now = new Date().toISOString();
    db.insert(knowledgeEntries).values({
      id, content,
      embedding: embedding ? JSON.stringify(embedding) : null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdBy: req.user?.id || null,
      createdAt: now, updatedAt: now,
    }).run();
    auditFromReq(req, "memory.write", { type: "knowledge", id });
    res.status(201).json({ id, hasEmbedding: !!embedding });
  } catch (err) {
    console.error("Failed to ingest knowledge:", err);
    res.status(500).json({ error: "Failed to ingest knowledge" });
  }
});

// Semantic search
router.post("/search", async (req, res) => {
  try {
    const { query, topK = 10 } = req.body;
    if (!query) return res.status(400).json({ error: "query required" });

    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) {
      return res.status(503).json({ error: "Embedding generation unavailable — configure an OpenAI API key in Settings" });
    }

    // Brute-force cosine similarity (works without sqlite-vec)
    const allEntries = db.select().from(knowledgeEntries).all();
    const scored = allEntries
      .filter(e => e.embedding) // Only entries with embeddings
      .map(e => ({
        ...e,
        metadata: e.metadata ? JSON.parse(e.metadata) : null,
        similarity: cosineSimilarity(queryEmbedding, JSON.parse(e.embedding!)),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    res.json({ results: scored, totalWithEmbeddings: allEntries.filter(e => e.embedding).length });
  } catch (err) {
    console.error("Failed to search knowledge:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// List entries with pagination
router.get("/entries", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const entries = db.select({
      id: knowledgeEntries.id, content: knowledgeEntries.content,
      metadata: knowledgeEntries.metadata, createdBy: knowledgeEntries.createdBy,
      createdAt: knowledgeEntries.createdAt, hasEmbedding: sql<boolean>`${knowledgeEntries.embedding} IS NOT NULL`,
    }).from(knowledgeEntries).orderBy(desc(knowledgeEntries.createdAt)).limit(limit).offset(offset).all();
    const total = db.select({ count: sql<number>`count(*)` }).from(knowledgeEntries).get()?.count || 0;
    res.json({ entries, total, limit, offset });
  } catch (err) {
    console.error("Failed to list entries:", err);
    res.status(500).json({ error: "Failed to list entries" });
  }
});

// Delete entry
router.delete("/entries/:id", async (req, res) => {
  try {
    const entry = db.select().from(knowledgeEntries).where(eq(knowledgeEntries.id, req.params.id)).get();
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    db.delete(knowledgeEntries).where(eq(knowledgeEntries.id, req.params.id)).run();
    auditFromReq(req, "memory.delete", { type: "knowledge", id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete entry:", err);
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

export { router as knowledgeRouter };
