import { Router } from "express";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { agents, apiKeys } from "../db/schema.js";
import { getTailscaleStatus, discoverAgents, isTailscaleRunning, getTailscaleIp } from "./discovery.js";

const router = Router();
router.use(requireAuth);

// GET /api/tailscale/status
router.get("/status", async (_req, res) => {
  if (!config.tailscaleEnabled) {
    return res.status(404).json({ error: "Tailscale not enabled" });
  }
  try {
    const running = await isTailscaleRunning();
    if (!running) return res.json({ connected: false });
    const status = await getTailscaleStatus();
    res.json({
      connected: true,
      hostname: status.Self.HostName,
      ip: status.Self.TailscaleIPs?.[0],
      tags: status.Self.Tags,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tailscale/peers
router.get("/peers", async (_req, res) => {
  if (!config.tailscaleEnabled) {
    return res.status(404).json({ error: "Tailscale not enabled" });
  }
  try {
    const discovered = await discoverAgents();
    const registered = db.select().from(agents).all();
    const registeredIps = new Set(registered.map((a) => a.tailscaleIp).filter(Boolean));

    const peers = discovered.map((p) => ({
      ...p,
      registered: registeredIps.has(p.ip),
    }));
    res.json(peers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tailscale/auto-register
router.post("/auto-register", requireRole("canManageAgents"), async (req, res) => {
  if (!config.tailscaleEnabled) {
    return res.status(404).json({ error: "Tailscale not enabled" });
  }
  const { tailscaleIp, port } = req.body;
  if (!tailscaleIp) return res.status(400).json({ error: "tailscaleIp required" });

  const agentPort = port || 8100;

  try {
    // Create an API key for the agent
    const rawKey = `mck_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 12);
    const keyId = uuid();

    db.insert(apiKeys).values({
      id: keyId,
      name: `tailscale-auto-${tailscaleIp}`,
      keyHash,
      keyPrefix,
      createdBy: req.user!.id,
    }).run();

    // Get the dashboard's OWN Tailscale IP (not the agent's)
    const dashboardTsIp = await getTailscaleIp();

    // Push the key to the agent's accept-registration endpoint
    const agentUrl = `http://${tailscaleIp}:${agentPort}`;

    const resp = await fetch(`${agentUrl}/api/tailscale/accept-registration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dashboard_url: `http://${dashboardTsIp}:${config.port}`,
        api_key: rawKey,
      }),
    });

    if (!resp.ok) {
      return res.status(502).json({ error: "Agent rejected registration" });
    }

    res.json({ status: "registration_initiated", agentUrl });
  } catch (err: any) {
    res.status(502).json({ error: `Failed to reach agent: ${err.message}` });
  }
});

export { router as tailscaleRouter };
