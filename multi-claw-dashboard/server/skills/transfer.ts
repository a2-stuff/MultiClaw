import { db } from "../db/index.js";
import { agents } from "../db/schema.js";
import { eq } from "drizzle-orm";
import fs from "fs";

export async function transferSkillToAgent(
  agentId: string, metadata: object, filePaths: { originalname: string; path: string }[]
): Promise<{ success: boolean; error?: string }> {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent) return { success: false, error: "Agent not found" };
  const form = new FormData();
  form.append("metadata", JSON.stringify(metadata));
  for (const file of filePaths) {
    const content = fs.readFileSync(file.path);
    const blob = new Blob([content]);
    form.append("files", blob, file.originalname);
  }
  try {
    const resp = await fetch(`${agent.url}/api/skills/install`, {
      method: "POST", headers: { "X-API-Key": agent.apiKey }, body: form,
    });
    if (!resp.ok) return { success: false, error: await resp.text() };
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
}
