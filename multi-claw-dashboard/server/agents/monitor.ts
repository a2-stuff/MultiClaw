import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents } from "../db/schema.js";
import { sseManager } from "../sse/manager.js";
import { wsManager } from "../ws/manager.js";
import { syncConfigToAgent } from "./config-sync.js";
import { resolveAgentUrl } from "../tailscale/helpers.js";
import { config } from "../config.js";
import { startSpawnedAgent } from "./spawn.js";

export class AgentMonitor {
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private discoveryInterval: ReturnType<typeof setInterval> | null = null;

  start() {
    // Auto-start any locally-spawned agents that aren't running
    this.autoStartSpawnedAgents();
    this.healthInterval = setInterval(() => this.checkAgents(), 15000);
    if (config.tailscaleEnabled) {
      this.discoveryInterval = setInterval(() => this.discoverTailscalePeers(), 60000);
      this.discoverTailscalePeers();
    }
  }

  private autoStartSpawnedAgents() {
    const { execSync } = require("child_process");
    const allAgents = db.select().from(agents).all();
    for (const agent of allAgents) {
      if (!agent.spawnedLocally || !agent.spawnDir || agent.containerId) continue;

      // Check if process is actually running (by PID)
      const pidAlive = agent.spawnPid ? (() => {
        try { process.kill(agent.spawnPid, 0); return true; } catch { return false; }
      })() : false;
      if (pidAlive) continue;

      // Check if port is already in use (agent may be managed externally, e.g. systemd)
      if (agent.spawnPort) {
        try {
          const out = execSync(`lsof -ti tcp:${agent.spawnPort} 2>/dev/null || true`, { encoding: "utf-8" }).trim();
          if (out) {
            // Port occupied — agent is running externally, just clear stale PID
            db.update(agents).set({ spawnPid: null }).where(eq(agents.id, agent.id)).run();
            continue;
          }
        } catch {}
      }

      try {
        const pid = startSpawnedAgent(agent.id);
        console.log(`Auto-started spawned agent '${agent.name}' (PID ${pid}, port ${agent.spawnPort})`);
      } catch (err: any) {
        console.warn(`Failed to auto-start agent '${agent.name}': ${err.message}`);
      }
    }
  }

  stop() {
    if (this.healthInterval) clearInterval(this.healthInterval);
    if (this.discoveryInterval) clearInterval(this.discoveryInterval);
  }

  async checkAgents() {
    const allAgents = db.select().from(agents).all();
    for (const agent of allAgents) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(`${resolveAgentUrl(agent)}/health/detailed`, {
          signal: controller.signal,
          headers: { "X-API-Key": agent.apiKey },
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const data = await resp.json();
          db.update(agents).set({ status: data.current_status || "online", lastSeen: new Date().toISOString(), metadata: JSON.stringify(data) }).where(eq(agents.id, agent.id)).run();
          await syncConfigToAgent(agent.id);
        } else {
          db.update(agents).set({ status: "error" }).where(eq(agents.id, agent.id)).run();
        }
      } catch {
        db.update(agents).set({ status: "offline" }).where(eq(agents.id, agent.id)).run();
      }
    }
    const updated = db.select({ id: agents.id, name: agents.name, status: agents.status, lastSeen: agents.lastSeen }).from(agents).all();
    sseManager.broadcast("agents_update", updated);
    wsManager.broadcast("agents_update", updated);

    // Check for dead spawned processes
    for (const agent of allAgents) {
      if (agent.spawnPid && agent.spawnedLocally && !agent.spawnHost) {
        try {
          process.kill(agent.spawnPid, 0);
        } catch {
          db.update(agents).set({ spawnPid: null, status: "offline" }).where(eq(agents.id, agent.id)).run();
        }
      }
    }
  }

  async discoverTailscalePeers() {
    try {
      const { discoverAgents: discoverTsAgents } = await import("../tailscale/discovery.js");
      const discovered = await discoverTsAgents();
      const registered = db.select().from(agents).all();
      const registeredIps = new Set(registered.map((a) => a.tailscaleIp).filter(Boolean));

      const unregistered = discovered.filter((p) => !registeredIps.has(p.ip));
      if (unregistered.length > 0) {
        sseManager.broadcast("tailscale_discovery", unregistered);
        wsManager.broadcast("tailscale_discovery", unregistered);
      }
    } catch {
      // Tailscale not available — silently skip
    }
  }
}

export const agentMonitor = new AgentMonitor();
