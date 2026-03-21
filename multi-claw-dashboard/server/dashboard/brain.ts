import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db/index.js";
import { settings, knowledgeEntries } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { buildDashboardPrompt } from "./profile.js";
import { getMemoryContext, formatMemoryBlock } from "./memory-context.js";

function getAnthropicKey(): string | null {
  const row = db.select().from(settings).where(eq(settings.key, "anthropic_api_key")).get();
  return row?.value || null;
}

function getDefaultModel(): string {
  const row = db.select().from(settings).where(eq(settings.key, "default_model")).get();
  return row?.value || "claude-sonnet-4-6";
}

function getClient(): Anthropic | null {
  const key = getAnthropicKey();
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

/**
 * Answer a direct query using the dashboard's admin profile.
 * Used when no agents are @tagged.
 */
export async function answerDirectQuery(prompt: string): Promise<string> {
  const client = getClient();
  if (!client) throw new Error("Anthropic API key not configured in Settings");

  const systemPrompt = await buildDashboardPrompt();
  const memoryEntries = await getMemoryContext(prompt);
  const memoryBlock = formatMemoryBlock(memoryEntries);
  const userMessage = memoryBlock ? `${memoryBlock}${prompt}` : prompt;

  const response = await client.messages.create({
    model: getDefaultModel(),
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const answer = response.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");

  // Write answer to memory for future reference
  await writeToMemory(answer, {
    type: "dashboard_answer",
    prompt,
    timestamp: new Date().toISOString(),
  });

  return answer;
}

/**
 * Synthesize parallel agent results into a unified summary.
 */
export async function synthesizeResults(
  originalPrompt: string,
  agentResults: Array<{ agentName: string; status: string; result?: string; error?: string }>
): Promise<string> {
  const client = getClient();
  if (!client) throw new Error("Anthropic API key not configured in Settings");

  const systemPrompt = await buildDashboardPrompt();
  const memoryEntries = await getMemoryContext(originalPrompt);
  const memoryBlock = formatMemoryBlock(memoryEntries);

  const resultsBlock = agentResults.map(r => {
    if (r.status === "completed") {
      return `### ${r.agentName} (completed)\n${r.result}`;
    } else {
      return `### ${r.agentName} (${r.status})\nError: ${r.error || "Unknown error"}`;
    }
  }).join("\n\n");

  const userMessage = `${memoryBlock}Original task: ${originalPrompt}

## Agent Results (all must be represented in synthesis)

${resultsBlock}

Synthesize these parallel agent results into a coherent summary. Note agreements, contradictions, and gaps. All agent responses must be represented.`;

  const response = await client.messages.create({
    model: getDefaultModel(),
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const synthesis = response.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");

  // Write synthesis to memory tagged as synthesis type
  await writeToMemory(synthesis, {
    type: "synthesis",
    prompt: originalPrompt,
    agents: agentResults.map(r => r.agentName),
    timestamp: new Date().toISOString(),
  });

  return synthesis;
}

async function writeToMemory(content: string, metadata: Record<string, unknown>): Promise<void> {
  try {
    const { generateEmbedding } = await import("../memory/embeddings.js");
    const embedding = await generateEmbedding(content);
    db.insert(knowledgeEntries).values({
      id: uuid(),
      content,
      embedding: embedding ? JSON.stringify(embedding) : null,
      metadata: JSON.stringify(metadata),
      createdBy: "dashboard",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).run();
  } catch (err) {
    console.error("Failed to write to memory (non-blocking):", err);
  }
}
