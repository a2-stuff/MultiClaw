import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents } from "../db/schema.js";
import { requireAuth, requireRole } from "../auth/middleware.js";

const router = Router();
router.use(requireAuth);
router.use(requireRole("canManageAgents"));

async function proxyToAgent(
  agentId: string,
  path: string,
  method: string,
  body?: unknown,
  timeoutMs = 15_000,
) {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent) return { status: 404, data: { error: "Agent not found" } };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const opts: RequestInit = {
      method,
      headers: { "X-API-Key": agent.apiKey, "Content-Type": "application/json" },
      signal: controller.signal,
    };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(`${agent.url}/api/crons${path}`, opts);
    clearTimeout(timeout);
    const data = await resp.json().catch(() => ({}));
    return { status: resp.status, data };
  } catch (e: unknown) {
    const msg = e instanceof Error && e.name === "AbortError"
      ? "Agent request timed out"
      : e instanceof Error ? e.message : "Unknown error";
    return { status: 502, data: { error: `Agent unreachable: ${msg}` } };
  }
}

// GET / — fetch crons from all agents, merge results
router.get("/", async (req, res) => {
  const agentIdFilter = req.query.agentId as string | undefined;

  const allAgents = agentIdFilter
    ? db.select().from(agents).where(eq(agents.id, agentIdFilter)).all()
    : db.select().from(agents).all();

  const results = await Promise.allSettled(
    allAgents.map(async (agent) => {
      const { status, data } = await proxyToAgent(agent.id, "", "GET", undefined, 10_000);
      if (status !== 200) return { agentId: agent.id, agentName: agent.name, crons: [], offline: true };
      const crons = Array.isArray(data) ? data : [];
      return {
        agentId: agent.id,
        agentName: agent.name,
        crons: crons.map((c: Record<string, unknown>) => ({ ...c, agentId: agent.id, agentName: agent.name })),
        offline: false,
      };
    })
  );

  const merged: Record<string, unknown>[] = [];
  const offlineAgents: string[] = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value.offline) offlineAgents.push(r.value.agentName);
      else merged.push(...r.value.crons);
    }
  }

  res.json({ crons: merged, offlineAgents });
});

router.post("/:agentId", async (req, res) => {
  const { status, data } = await proxyToAgent(req.params.agentId, "", "POST", req.body);
  res.status(status).json(data);
});

router.put("/:agentId/:cronId", async (req, res) => {
  const { status, data } = await proxyToAgent(req.params.agentId, `/${req.params.cronId}`, "PUT", req.body);
  res.status(status).json(data);
});

router.delete("/:agentId/:cronId", async (req, res) => {
  const { status, data } = await proxyToAgent(req.params.agentId, `/${req.params.cronId}`, "DELETE");
  res.status(status).json(data);
});

router.post("/:agentId/:cronId/run", async (req, res) => {
  const { status, data } = await proxyToAgent(req.params.agentId, `/${req.params.cronId}/run`, "POST");
  res.status(status).json(data);
});

router.get("/:agentId/:cronId/runs", async (req, res) => {
  const { status, data } = await proxyToAgent(req.params.agentId, `/${req.params.cronId}/runs`, "GET");
  res.status(status).json(data);
});

export { router as cronsRouter };
