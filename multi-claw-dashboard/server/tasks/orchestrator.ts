import { v4 as uuid } from "uuid";
import { db } from "../db/index.js";
import { agents, agentTasks, orchestrations as orchestrationsTable } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { sseManager } from "../sse/manager.js";
import { wsManager } from "../ws/manager.js";
import { answerDirectQuery, synthesizeResults } from "../dashboard/brain.js";
import { getMemoryContext, formatMemoryBlock } from "../dashboard/memory-context.js";

export interface OrchestrationStep {
  agentId: string;
  agentName: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Orchestration {
  id: string;
  prompt: string;
  mode: "parallel" | "direct" | "dashboard";
  agentIds: string[];
  steps: OrchestrationStep[];
  status: "running" | "completed" | "failed";
  synthesis?: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
}

// In-memory cache for active/recently active orchestrations
const activeOrchestrations = new Map<string, Orchestration>();

// ── Broadcast helper ──────────────────────────────────────────────────────────

function broadcast(event: string, payload: Record<string, unknown>) {
  sseManager.broadcast(event, payload);
  wsManager.broadcast(event, payload);
}

// ── Persistence helpers ───────────────────────────────────────────────────────

function persistOrchestration(orch: Orchestration) {
  db.insert(orchestrationsTable)
    .values({
      id: orch.id,
      prompt: orch.prompt,
      mode: orch.mode,
      status: orch.status,
      agentIds: JSON.stringify(orch.agentIds),
      synthesis: orch.synthesis ?? null,
      error: null,
      createdBy: orch.createdBy,
      createdAt: orch.createdAt,
      completedAt: orch.completedAt ?? null,
    })
    .run();
}

function updateOrchestrationInDB(
  id: string,
  fields: Partial<{
    status: "running" | "completed" | "failed";
    synthesis: string;
    error: string;
    completedAt: string;
  }>
) {
  db.update(orchestrationsTable).set(fields).where(eq(orchestrationsTable.id, id)).run();
}

// ── Public query functions ────────────────────────────────────────────────────

export function getOrchestration(id: string): Orchestration | undefined {
  // Check cache first
  const cached = activeOrchestrations.get(id);
  if (cached) return cached;

  // Fall back to DB
  const row = db
    .select()
    .from(orchestrationsTable)
    .where(eq(orchestrationsTable.id, id))
    .get();

  if (!row) return undefined;

  return {
    id: row.id,
    prompt: row.prompt,
    mode: row.mode as Orchestration["mode"],
    agentIds: row.agentIds ? JSON.parse(row.agentIds) : [],
    steps: [],
    status: row.status as Orchestration["status"],
    synthesis: row.synthesis ?? undefined,
    createdBy: row.createdBy ?? "",
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? undefined,
  };
}

export function listOrchestrations(): Orchestration[] {
  const rows = db
    .select()
    .from(orchestrationsTable)
    .orderBy(desc(orchestrationsTable.createdAt))
    .limit(50)
    .all();

  return rows.map((row) => {
    // Merge cache data if available (includes live steps)
    const cached = activeOrchestrations.get(row.id);
    if (cached) return cached;

    return {
      id: row.id,
      prompt: row.prompt,
      mode: row.mode as Orchestration["mode"],
      agentIds: row.agentIds ? JSON.parse(row.agentIds) : [],
      steps: [],
      status: row.status as Orchestration["status"],
      synthesis: row.synthesis ?? undefined,
      createdBy: row.createdBy ?? "",
      createdAt: row.createdAt,
      completedAt: row.completedAt ?? undefined,
    };
  });
}

// ── Dashboard direct query (no agents) ───────────────────────────────────────

export async function runDashboardQuery(prompt: string, createdBy: string): Promise<string> {
  const orchId = uuid();
  const now = new Date().toISOString();

  const orch: Orchestration = {
    id: orchId,
    prompt,
    mode: "dashboard",
    agentIds: [],
    steps: [],
    status: "running",
    createdBy,
    createdAt: now,
  };

  activeOrchestrations.set(orchId, orch);
  persistOrchestration(orch);

  broadcast("dashboard_answer_start", { id: orchId, prompt });

  // Fire and forget — non-blocking
  (async () => {
    try {
      const answer = await answerDirectQuery(prompt);

      orch.status = "completed";
      orch.synthesis = answer;
      orch.completedAt = new Date().toISOString();

      updateOrchestrationInDB(orchId, {
        status: "completed",
        synthesis: answer,
        completedAt: orch.completedAt,
      });

      broadcast("dashboard_answer", { id: orchId, answer });
    } catch (err: any) {
      orch.status = "failed";
      orch.completedAt = new Date().toISOString();

      updateOrchestrationInDB(orchId, {
        status: "failed",
        error: err.message,
        completedAt: orch.completedAt,
      });

      broadcast("orchestration_error", { id: orchId, error: err.message });
    }
  })();

  return orchId;
}

// ── Agent dispatch ────────────────────────────────────────────────────────────

export async function runOrchestration(
  prompt: string,
  agentIds: string[],
  createdBy: string
): Promise<string> {
  const orchId = uuid();
  const now = new Date().toISOString();

  const agentDetails = agentIds
    .map((id) => db.select().from(agents).where(eq(agents.id, id)).get())
    .filter(Boolean) as any[];

  if (agentDetails.length === 0) {
    throw new Error("No valid agents selected");
  }

  const mode: Orchestration["mode"] = agentDetails.length === 1 ? "direct" : "parallel";

  const steps: OrchestrationStep[] = agentDetails.map((a) => ({
    agentId: a.id,
    agentName: a.name,
    status: "pending" as const,
  }));

  const orch: Orchestration = {
    id: orchId,
    prompt,
    mode,
    agentIds,
    steps,
    status: "running",
    createdBy,
    createdAt: now,
  };

  activeOrchestrations.set(orchId, orch);
  persistOrchestration(orch);

  broadcast("orchestration_start", {
    id: orchId,
    prompt,
    mode,
    steps: steps.map((s) => ({ agentId: s.agentId, agentName: s.agentName, status: s.status })),
  });

  // Fire and forget — non-blocking
  if (mode === "parallel") {
    executeParallel(orch, agentDetails).catch((err) => {
      orch.status = "failed";
      updateOrchestrationInDB(orchId, { status: "failed", error: err.message });
      broadcast("orchestration_error", { id: orchId, error: err.message });
    });
  } else {
    executeDirectDispatch(orch, agentDetails[0]).catch((err) => {
      orch.status = "failed";
      updateOrchestrationInDB(orchId, { status: "failed", error: err.message });
      broadcast("orchestration_error", { id: orchId, error: err.message });
    });
  }

  return orchId;
}

// ── Parallel execution ────────────────────────────────────────────────────────

async function executeParallel(orch: Orchestration, agentDetails: any[]) {
  // Inject memory context into the prompt
  const memoryEntries = await getMemoryContext(orch.prompt);
  const memoryBlock = formatMemoryBlock(memoryEntries);
  const enrichedPrompt = memoryBlock ? `${memoryBlock}${orch.prompt}` : orch.prompt;

  // Dispatch all agents in parallel
  const results = await Promise.allSettled(
    agentDetails.map((agent, i) => dispatchAndPoll(orch, agent, i, enrichedPrompt))
  );

  // Map results back to steps
  results.forEach((result, i) => {
    const step = orch.steps[i];
    if (result.status === "fulfilled") {
      step.status = "completed";
      step.result = result.value;
      step.completedAt = new Date().toISOString();
    } else {
      step.status = "failed";
      step.error = result.reason?.message ?? "Unknown error";
      step.completedAt = new Date().toISOString();
    }
  });

  const anyCompleted = orch.steps.some((s) => s.status === "completed");
  const allFailed = orch.steps.every((s) => s.status === "failed");

  if (allFailed) {
    orch.status = "failed";
    orch.completedAt = new Date().toISOString();
    updateOrchestrationInDB(orch.id, {
      status: "failed",
      error: "All agents failed",
      completedAt: orch.completedAt,
    });
    broadcast("orchestration_error", { id: orch.id, error: "All agents failed" });
    return;
  }

  // Synthesize results if at least one agent completed
  if (anyCompleted) {
    broadcast("synthesis_start", { id: orch.id });

    try {
      const agentResultsForSynthesis = orch.steps.map((s) => ({
        agentName: s.agentName,
        status: s.status,
        result: s.result,
        error: s.error,
      }));

      const synthesis = await synthesizeResults(orch.prompt, agentResultsForSynthesis);

      orch.synthesis = synthesis;
      orch.status = "completed";
      orch.completedAt = new Date().toISOString();

      updateOrchestrationInDB(orch.id, {
        status: "completed",
        synthesis,
        completedAt: orch.completedAt,
      });

      broadcast("synthesis_complete", {
        id: orch.id,
        synthesis,
        steps: orch.steps.map((s) => ({
          agentId: s.agentId,
          agentName: s.agentName,
          status: s.status,
          result: s.result,
          error: s.error,
        })),
      });
    } catch (err: any) {
      orch.status = "failed";
      orch.completedAt = new Date().toISOString();
      updateOrchestrationInDB(orch.id, {
        status: "failed",
        error: `Synthesis failed: ${err.message}`,
        completedAt: orch.completedAt,
      });
      broadcast("synthesis_error", { id: orch.id, error: err.message });
    }
  }
}

// ── Direct single-agent dispatch ──────────────────────────────────────────────

async function executeDirectDispatch(orch: Orchestration, agent: any) {
  const step = orch.steps[0];

  try {
    const result = await dispatchAndPoll(orch, agent, 0, orch.prompt);

    step.status = "completed";
    step.result = result;
    step.completedAt = new Date().toISOString();

    orch.status = "completed";
    orch.completedAt = new Date().toISOString();

    updateOrchestrationInDB(orch.id, {
      status: "completed",
      completedAt: orch.completedAt,
    });

    broadcast("orchestration_complete", {
      id: orch.id,
      steps: orch.steps.map((s) => ({
        agentId: s.agentId,
        agentName: s.agentName,
        status: s.status,
        result: s.result,
      })),
    });
  } catch (err: any) {
    step.status = "failed";
    step.error = err.message;
    step.completedAt = new Date().toISOString();

    orch.status = "failed";
    orch.completedAt = new Date().toISOString();

    updateOrchestrationInDB(orch.id, {
      status: "failed",
      error: err.message,
      completedAt: orch.completedAt,
    });

    broadcast("orchestration_error", { id: orch.id, error: err.message });
  }
}

// ── Shared dispatch + poll helper ─────────────────────────────────────────────

async function dispatchAndPoll(
  orch: Orchestration,
  agent: any,
  stepIndex: number,
  prompt: string
): Promise<string> {
  const step = orch.steps[stepIndex];

  step.status = "running";
  step.startedAt = new Date().toISOString();

  broadcast("orchestration_step", {
    id: orch.id,
    stepIndex,
    agentId: agent.id,
    agentName: agent.name,
    status: "running",
  });

  const resp = await fetch(`${agent.url}/api/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": agent.apiKey,
    },
    body: JSON.stringify({
      prompt,
      provider: agent.defaultProvider || "",
      model: agent.defaultModel || "",
    }),
  });

  if (!resp.ok) {
    throw new Error(`Agent ${agent.name} rejected task: ${resp.status}`);
  }

  const { task_id } = await resp.json();

  const dbId = uuid();
  db.insert(agentTasks)
    .values({
      id: dbId,
      agentId: agent.id,
      prompt,
      status: "running",
      createdBy: orch.createdBy,
    })
    .run();

  const result = await pollTaskCompletion(agent, task_id, orch.id, stepIndex);

  db.update(agentTasks)
    .set({ status: "completed", result, completedAt: new Date().toISOString() })
    .where(eq(agentTasks.id, dbId))
    .run();

  broadcast("orchestration_step", {
    id: orch.id,
    stepIndex,
    agentId: agent.id,
    agentName: agent.name,
    status: "completed",
    result,
  });

  return result;
}

// ── Polling ───────────────────────────────────────────────────────────────────

async function pollTaskCompletion(
  agent: any,
  taskId: string,
  orchId: string,
  stepIndex: number
): Promise<string> {
  const maxWait = 120_000;
  const interval = 1_000;
  let waited = 0;

  while (waited < maxWait) {
    try {
      const resp = await fetch(`${agent.url}/api/tasks/${taskId}`, {
        headers: { "X-API-Key": agent.apiKey },
      });
      if (resp.ok) {
        const data = await resp.json();
        broadcast("orchestration_progress", {
          id: orchId,
          stepIndex,
          taskStatus: data.status,
        });
        if (data.status === "completed") return data.result || "";
        if (data.status === "failed") throw new Error(data.error || "Task failed");
      }
    } catch (err: any) {
      if (err.message.includes("Task failed")) throw err;
    }
    await new Promise((r) => setTimeout(r, interval));
    waited += interval;
  }
  throw new Error(`Task timed out after ${maxWait / 1000}s`);
}

// ── Legacy chain execution (preserved for backwards compatibility) ─────────────

/** @deprecated Use runOrchestration with parallel execution instead. */
async function executeChain(orch: Orchestration, agentDetails: any[]) {
  let context = orch.prompt;

  for (let i = 0; i < agentDetails.length; i++) {
    const agent = agentDetails[i];
    const step = orch.steps[i];

    step.status = "running";
    step.startedAt = new Date().toISOString();

    broadcast("orchestration_step", {
      id: orch.id,
      stepIndex: i,
      agentId: agent.id,
      agentName: agent.name,
      status: "running",
    });

    try {
      const agentPrompt =
        i === 0
          ? context
          : `You are agent ${i + 1} in a collaborative chain. The previous agent produced this result:\n\n---\n${context}\n---\n\nOriginal task: ${orch.prompt}\n\nContinue the work. Build on what was done. Add your contribution.`;

      const resp = await fetch(`${agent.url}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": agent.apiKey,
        },
        body: JSON.stringify({
          prompt: agentPrompt,
          provider: agent.defaultProvider || "",
          model: agent.defaultModel || "",
        }),
      });

      if (!resp.ok) {
        throw new Error(`Agent ${agent.name} rejected task: ${resp.status}`);
      }

      const { task_id } = await resp.json();

      const dbId = uuid();
      db.insert(agentTasks)
        .values({
          id: dbId,
          agentId: agent.id,
          prompt: agentPrompt,
          status: "running",
          createdBy: orch.createdBy,
        })
        .run();

      const result = await pollTaskCompletion(agent, task_id, orch.id, i);

      step.result = result;
      step.status = "completed";
      step.completedAt = new Date().toISOString();
      context = result;

      db.update(agentTasks)
        .set({ status: "completed", result, completedAt: new Date().toISOString() })
        .where(eq(agentTasks.id, dbId))
        .run();

      broadcast("orchestration_step", {
        id: orch.id,
        stepIndex: i,
        agentId: agent.id,
        agentName: agent.name,
        status: "completed",
        result,
      });
    } catch (err: any) {
      step.status = "failed";
      step.error = err.message;
      step.completedAt = new Date().toISOString();
      orch.status = "failed";

      broadcast("orchestration_step", {
        id: orch.id,
        stepIndex: i,
        agentId: agent.id,
        agentName: agent.name,
        status: "failed",
        error: err.message,
      });
      return;
    }
  }

  orch.status = "completed";
  broadcast("orchestration_complete", {
    id: orch.id,
    steps: orch.steps.map((s) => ({
      agentId: s.agentId,
      agentName: s.agentName,
      status: s.status,
      result: s.result,
    })),
  });
}
