import { db } from "../db/index.js";
import { knowledgeEntries } from "../db/schema.js";
import { like, desc } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "../memory/embeddings.js";

interface MemoryEntry {
  label: string;
  content: string;
  similarity?: number;
}

/**
 * Search memory for relevant context to inject into agent prompts.
 * Falls back to keyword search if embeddings are unavailable.
 * Never throws — returns empty array on failure.
 */
export async function getMemoryContext(query: string, topK: number = 10): Promise<MemoryEntry[]> {
  try {
    // Try semantic search first
    const queryEmbedding = await generateEmbedding(query);
    if (queryEmbedding) {
      const allEntries = db.select().from(knowledgeEntries).all();
      const scored = allEntries
        .filter(e => e.embedding)
        .map(e => ({
          label: extractLabel(e.content, e.metadata),
          content: e.content,
          similarity: cosineSimilarity(queryEmbedding, JSON.parse(e.embedding!)),
        }))
        .sort((a, b) => b.similarity! - a.similarity!)
        .slice(0, topK);
      if (scored.length > 0) return scored;
    }

    // Fallback: keyword search
    const keywords = query.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
    if (keywords.length === 0) return [];

    const results: MemoryEntry[] = [];
    for (const keyword of keywords) {
      const matches = db.select().from(knowledgeEntries)
        .where(like(knowledgeEntries.content, `%${keyword}%`))
        .orderBy(desc(knowledgeEntries.createdAt))
        .limit(topK)
        .all();
      for (const m of matches) {
        if (!results.find(r => r.content === m.content)) {
          results.push({ label: extractLabel(m.content, m.metadata), content: m.content });
        }
      }
      if (results.length >= topK) break;
    }
    return results.slice(0, topK);
  } catch (err) {
    console.error("Memory context search failed (non-blocking):", err);
    return [];
  }
}

/**
 * Format memory entries into a prompt block for injection.
 */
export function formatMemoryBlock(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e, i) => `${i + 1}. ${e.label}: ${e.content}`).join("\n");
  return `[SHARED KNOWLEDGE — from centralized memory]\n${lines}\n[END SHARED KNOWLEDGE]\n\n`;
}

function extractLabel(content: string, metadataJson: string | null): string {
  if (metadataJson) {
    try {
      const meta = JSON.parse(metadataJson);
      if (meta.title) return meta.title;
    } catch {}
  }
  return content.slice(0, 80).replace(/\n/g, " ").trim();
}
