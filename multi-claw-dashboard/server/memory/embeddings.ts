import { db } from "../db/index.js";
import { settings } from "../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * Generate embedding for text content using configured provider.
 * Falls back to null if no API key is configured.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  // Try OpenAI embedding API (most common)
  const openaiKey = db.select().from(settings).where(eq(settings.key, "openai_api_key")).get();
  if (openaiKey?.value) {
    try {
      const resp = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey.value}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: text, model: "text-embedding-3-small" }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.data[0].embedding;
      }
    } catch (err) {
      console.error("Embedding generation failed:", err);
    }
  }
  return null; // No embedding available — store content without vector
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
