import { db } from "../db/index.js";
import { agents, settings } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { resolveAgentUrl } from "../tailscale/helpers.js";

export async function syncConfigToAgent(agentId: string): Promise<boolean> {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent) return false;

  const providerKeys = [
    "anthropic_api_key",
    "openai_api_key",
    "google_api_key",
    "openrouter_api_key",
    "deepseek_api_key",
  ];

  const config: Record<string, string> = {};
  for (const key of providerKeys) {
    const setting = db.select().from(settings).where(eq(settings.key, key)).get();
    if (setting?.value) {
      config[key] = setting.value;
    }
  }

  if (agent.identity) {
    config.identity = agent.identity;
  }

  if (Object.keys(config).length === 0) return true;

  try {
    const resp = await fetch(`${resolveAgentUrl(agent)}/api/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": agent.apiKey,
      },
      body: JSON.stringify(config),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function syncConfigToAllAgents(): Promise<{ agentId: string; success: boolean }[]> {
  const allAgents = db.select().from(agents).all();
  const results = [];
  for (const agent of allAgents) {
    const success = await syncConfigToAgent(agent.id);
    results.push({ agentId: agent.id, success });
  }
  return results;
}
