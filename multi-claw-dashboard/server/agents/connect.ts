import { Router } from "express";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents, apiKeys } from "../db/schema.js";
import { sseManager } from "../sse/manager.js";
import { wsManager } from "../ws/manager.js";
import { syncConfigToAgent } from "./config-sync.js";
import { validateAgentUrl } from "./url-validation.js";

const router = Router();

// Helper function to extract Tailscale IP from agent URL
function extractTailscaleIp(agentUrl: string): string | null {
  try {
    const host = new URL(agentUrl).hostname;
    const parts = host.split(".");
    if (parts.length === 4) {
      const [first, second] = parts.map(Number);
      if (first === 100 && second >= 64 && second <= 127) return host;
    }
  } catch {}
  return null;
}

// Public endpoint — agent authenticates with its API key, no JWT needed
router.post("/", async (req, res) => {
  try {
    const { api_key, agent_name, agent_url } = req.body;

    if (!api_key || !agent_name || !agent_url) {
      return res.status(400).json({ error: "api_key, agent_name, and agent_url required" });
    }

    if (!validateAgentUrl(agent_url)) {
      return res.status(400).json({ error: "Invalid agent URL. Must be http:// or https://" });
    }

    // Hash the key and look it up
    const keyHash = crypto.createHash("sha256").update(api_key).digest("hex");
    const keyRecord = db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .get();

    if (!keyRecord) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    if (keyRecord.status !== "active") {
      return res.status(403).json({ error: "API key has been revoked" });
    }

    // Record key usage
    db.update(apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, keyRecord.id))
      .run();

    // Generate a secret for dashboard-to-agent communication
    const agentSecret = `mca_${crypto.randomBytes(32).toString("hex")}`;

    // Check if agent already exists for this key
    let agentId: string;
    if (keyRecord.agentId) {
      // Key is already bound to an agent — update it
      const existing = db.select().from(agents).where(eq(agents.id, keyRecord.agentId)).get();
      if (existing) {
        db.update(agents)
          .set({
            name: agent_name,
            url: agent_url,
            apiKey: agentSecret,
            status: "online",
            lastSeen: new Date().toISOString(),
            tailscaleIp: extractTailscaleIp(agent_url) || undefined,
          })
          .where(eq(agents.id, existing.id))
          .run();
        agentId = existing.id;
      } else {
        // Agent was deleted, recreate
        agentId = uuid();
        db.insert(agents)
          .values({
            id: agentId,
            name: agent_name,
            url: agent_url,
            apiKey: agentSecret,
            status: "online",
            lastSeen: new Date().toISOString(),
            registeredBy: keyRecord.createdBy,
            tailscaleIp: extractTailscaleIp(agent_url),
          })
          .run();
        // Rebind key to new agent
        db.update(apiKeys)
          .set({ agentId })
          .where(eq(apiKeys.id, keyRecord.id))
          .run();
      }
    } else {
      // Key has no agent yet — check if agent with same URL exists
      const existingByUrl = db.select().from(agents).where(eq(agents.url, agent_url)).get();
      if (existingByUrl) {
        agentId = existingByUrl.id;
        db.update(agents)
          .set({
            name: agent_name,
            apiKey: agentSecret,
            status: "online",
            lastSeen: new Date().toISOString(),
            tailscaleIp: extractTailscaleIp(agent_url) || undefined,
          })
          .where(eq(agents.id, existingByUrl.id))
          .run();
      } else {
        agentId = uuid();
        db.insert(agents)
          .values({
            id: agentId,
            name: agent_name,
            url: agent_url,
            apiKey: agentSecret,
            status: "online",
            lastSeen: new Date().toISOString(),
            registeredBy: keyRecord.createdBy,
            tailscaleIp: extractTailscaleIp(agent_url),
          })
          .run();
      }
      // Bind key to agent
      db.update(apiKeys)
        .set({ agentId })
        .where(eq(apiKeys.id, keyRecord.id))
        .run();
    }

    // Broadcast to dashboard SSE + WS
    sseManager.broadcast("agent_connected", {
      agentId,
      name: agent_name,
      url: agent_url,
      timestamp: new Date().toISOString(),
    });
    wsManager.broadcast("agent_connected", {
      agentId,
      name: agent_name,
      url: agent_url,
      timestamp: new Date().toISOString(),
    });

    // Push provider keys to the new agent (async, don't block response)
    syncConfigToAgent(agentId).catch(() => {});

    res.json({
      agent_id: agentId,
      agent_secret: agentSecret,
      status: "connected",
    });
  } catch (err: any) {
    console.error("Agent connect error:", err);
    res.status(500).json({ error: "Connection failed" });
  }
});

export { router as connectRouter };
