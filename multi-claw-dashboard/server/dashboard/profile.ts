import { db } from "../db/index.js";
import { agents, settings, agentTasks, knowledgeEntries } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

/**
 * Build the dashboard administrator system prompt.
 * Combines user-customizable text with auto-injected live state.
 */
export async function buildDashboardPrompt(): Promise<string> {
  const profileSetting = db.select().from(settings).where(eq(settings.key, "dashboard_profile")).get();
  const customProfile = profileSetting?.value || "You are the MultiClaw Dashboard Administrator. You manage and monitor AI agents. Be concise and accurate.";

  const allAgents = db.select({
    id: agents.id,
    name: agents.name,
    status: agents.status,
    defaultModel: agents.defaultModel,
    identity: agents.identity,
    lastSeen: agents.lastSeen,
  }).from(agents).all();

  const taskCount = db.select({ count: sql<number>`count(*)` })
    .from(agentTasks)
    .where(eq(agentTasks.status, "running"))
    .get()?.count || 0;

  const memoryCount = db.select({ count: sql<number>`count(*)` })
    .from(knowledgeEntries)
    .get()?.count || 0;

  const agentList = allAgents.map(a => {
    const identitySummary = a.identity ? a.identity.slice(0, 80).replace(/\n/g, " ") + "..." : "no identity set";
    return `  - ${a.name} (${a.status}) — ${a.defaultModel} — "${identitySummary}"${a.lastSeen ? ` — last seen: ${a.lastSeen}` : ""}`;
  }).join("\n");

  const liveContext = `
---
SYSTEM STATE (auto-updated, read-only):
- Registered agents: ${allAgents.length}
${agentList}
- Active tasks: ${taskCount}
- Memory/knowledge entries: ${memoryCount}
- Available capabilities: agent status, task history, logs, API keys, settings, memory/knowledge base, orchestration history
- Current time: ${new Date().toISOString()}
`;

  return `${customProfile}\n${liveContext}`;
}

/**
 * Get just the live context portion for the Settings preview.
 */
export async function getLiveContextPreview(): Promise<string> {
  const prompt = await buildDashboardPrompt();
  const separator = "---\nSYSTEM STATE";
  const idx = prompt.indexOf(separator);
  return idx >= 0 ? prompt.slice(idx) : "";
}
