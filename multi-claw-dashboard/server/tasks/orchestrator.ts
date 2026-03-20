import { v4 as uuid } from "uuid";
import { db } from "../db/index.js";
import { agents, agentTasks } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { sseManager } from "../sse/manager.js";
import { wsManager } from "../ws/manager.js";

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
  agentIds: string[];
  steps: OrchestrationStep[];
  status: "running" | "completed" | "failed";
  createdBy: string;
  createdAt: string;
}

const orchestrations = new Map<string, Orchestration>();

export function getOrchestration(id: string): Orchestration | undefined {
  return orchestrations.get(id);
}

export function listOrchestrations(): Orchestration[] {
  return Array.from(orchestrations.values());
}

export async function runOrchestration(
  prompt: string,
  agentIds: string[],
  createdBy: string
): Promise<string> {
  const orchId = uuid();

  const agentDetails = agentIds
    .map((id) => db.select().from(agents).where(eq(agents.id, id)).get())
    .filter(Boolean) as any[];

  if (agentDetails.length === 0) {
    throw new Error("No valid agents selected");
  }

  const steps: OrchestrationStep[] = agentDetails.map((a) => ({
    agentId: a.id,
    agentName: a.name,
    status: "pending" as const,
  }));

  const orchestration: Orchestration = {
    id: orchId,
    prompt,
    agentIds,
    steps,
    status: "running",
    createdBy,
    createdAt: new Date().toISOString(),
  };

  orchestrations.set(orchId, orchestration);

  sseManager.broadcast("orchestration_start", {
    id: orchId,
    prompt,
    steps: steps.map((s) => ({ agentId: s.agentId, agentName: s.agentName, status: s.status })),
  });
  wsManager.broadcast("orchestration_start", {
    id: orchId,
    prompt,
    steps: steps.map((s) => ({ agentId: s.agentId, agentName: s.agentName, status: s.status })),
  });

  executeChain(orchestration, agentDetails).catch((err) => {
    orchestration.status = "failed";
    sseManager.broadcast("orchestration_error", { id: orchId, error: err.message });
    wsManager.broadcast("orchestration_error", { id: orchId, error: err.message });
  });

  return orchId;
}

async function executeChain(orch: Orchestration, agentDetails: any[]) {
  let context = orch.prompt;

  for (let i = 0; i < agentDetails.length; i++) {
    const agent = agentDetails[i];
    const step = orch.steps[i];

    step.status = "running";
    step.startedAt = new Date().toISOString();

    sseManager.broadcast("orchestration_step", {
      id: orch.id,
      stepIndex: i,
      agentId: agent.id,
      agentName: agent.name,
      status: "running",
    });
    wsManager.broadcast("orchestration_step", {
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
        body: JSON.stringify({ prompt: agentPrompt, provider: agent.defaultProvider || "", model: agent.defaultModel || "" }),
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

      sseManager.broadcast("orchestration_step", {
        id: orch.id,
        stepIndex: i,
        agentId: agent.id,
        agentName: agent.name,
        status: "completed",
        result,
      });
      wsManager.broadcast("orchestration_step", {
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

      sseManager.broadcast("orchestration_step", {
        id: orch.id,
        stepIndex: i,
        agentId: agent.id,
        agentName: agent.name,
        status: "failed",
        error: err.message,
      });
      wsManager.broadcast("orchestration_step", {
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
  sseManager.broadcast("orchestration_complete", {
    id: orch.id,
    steps: orch.steps.map((s) => ({
      agentId: s.agentId,
      agentName: s.agentName,
      status: s.status,
      result: s.result,
    })),
  });
  wsManager.broadcast("orchestration_complete", {
    id: orch.id,
    steps: orch.steps.map((s) => ({
      agentId: s.agentId,
      agentName: s.agentName,
      status: s.status,
      result: s.result,
    })),
  });
}

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
        sseManager.broadcast("orchestration_progress", {
          id: orchId,
          stepIndex,
          taskStatus: data.status,
        });
        wsManager.broadcast("orchestration_progress", {
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
