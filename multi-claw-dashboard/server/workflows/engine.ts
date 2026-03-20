import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { workflows, workflowRuns, workflowStepRuns, agentTasks, agents } from "../db/schema.js";
import { evaluateCondition } from "./expression.js";
import { auditLog } from "../audit/logger.js";
import { wsManager } from "../ws/manager.js";
import { sseManager } from "../sse/manager.js";

interface StepDef {
  agentId: string;
  prompt: string;
  next?: string[];
  condition?: string;
  retries?: number;
  timeout?: number;
}

interface WorkflowDef {
  steps: Record<string, StepDef>;
  entryPoints?: string[];
}

/**
 * Execute a workflow run. Resolves the DAG, dispatches steps, tracks completion.
 */
export async function executeWorkflow(runId: string): Promise<void> {
  const run = db.select().from(workflowRuns).where(eq(workflowRuns.id, runId)).get();
  if (!run) throw new Error("Run not found");

  const workflow = db.select().from(workflows).where(eq(workflows.id, run.workflowId)).get();
  if (!workflow) throw new Error("Workflow not found");

  const def: WorkflowDef = JSON.parse(workflow.definition);
  const stepOutputs: Record<string, any> = {};
  const workflowInput = run.input ? JSON.parse(run.input) : {};

  // Build context for template resolution
  const buildContext = () => ({
    workflow: { input: workflowInput },
    ...stepOutputs,
  });

  // Find entry points: explicit or infer (nodes with no incoming edges)
  const incomingEdges = new Set<string>();
  for (const step of Object.values(def.steps)) {
    for (const next of step.next || []) {
      incomingEdges.add(next);
    }
  }
  const entryPoints = def.entryPoints || Object.keys(def.steps).filter(s => !incomingEdges.has(s));

  // Create step run records
  for (const stepId of Object.keys(def.steps)) {
    db.insert(workflowStepRuns).values({
      id: uuid(), runId, stepId,
      agentId: def.steps[stepId].agentId,
      status: "pending",
      updatedAt: new Date().toISOString(),
    }).run();
  }

  broadcast("workflow_run_start", { runId, workflowId: workflow.id });

  // Process steps iteratively
  const completed = new Set<string>();
  const failed = new Set<string>();
  let hasProgress = true;

  while (hasProgress) {
    hasProgress = false;
    const readySteps = findReadySteps(def, completed, failed, entryPoints);

    if (readySteps.length === 0 && completed.size + failed.size < Object.keys(def.steps).length) {
      // Check if we're stuck (all remaining steps are blocked by failures)
      break;
    }

    // Execute ready steps in parallel
    const results = await Promise.allSettled(
      readySteps.map(stepId => executeStep(runId, stepId, def.steps[stepId], buildContext()))
    );

    for (let i = 0; i < results.length; i++) {
      const stepId = readySteps[i];
      const result = results[i];

      if (result.status === "fulfilled" && result.value !== null) {
        stepOutputs[stepId] = { output: result.value };
        completed.add(stepId);
        hasProgress = true;
      } else if (result.status === "fulfilled" && result.value === null) {
        // Step was skipped (condition not met)
        completed.add(stepId);
        hasProgress = true;
      } else {
        failed.add(stepId);
        hasProgress = true;
      }
    }
  }

  // Determine final status
  const allSteps = Object.keys(def.steps);
  const finalStatus = failed.size > 0 ? "failed" : completed.size === allSteps.length ? "completed" : "failed";

  // Find output from terminal nodes (nodes with no outgoing edges)
  const terminalNodes = allSteps.filter(s => !def.steps[s].next || def.steps[s].next!.length === 0);
  const output = terminalNodes.reduce((acc, s) => ({ ...acc, [s]: stepOutputs[s]?.output }), {});

  db.update(workflowRuns).set({
    status: finalStatus,
    output: JSON.stringify(output),
    completedAt: new Date().toISOString(),
  }).where(eq(workflowRuns.id, runId)).run();

  broadcast("workflow_run_complete", { runId, status: finalStatus });

  auditLog({
    actorType: "system", actorId: null,
    action: "workflow.complete", targetType: "workflow_run", targetId: runId,
    metadata: { status: finalStatus, stepsCompleted: completed.size, stepsFailed: failed.size },
  });
}

function findReadySteps(
  def: WorkflowDef,
  completed: Set<string>,
  failed: Set<string>,
  entryPoints: string[],
): string[] {
  const ready: string[] = [];
  for (const [stepId] of Object.entries(def.steps)) {
    if (completed.has(stepId) || failed.has(stepId)) continue;

    // Find dependencies: steps that have this step in their `next` array
    const dependencies = Object.entries(def.steps)
      .filter(([, s]) => s.next?.includes(stepId))
      .map(([id]) => id);

    // Entry points have no dependencies
    const isEntry = entryPoints.includes(stepId) && dependencies.length === 0;

    if (isEntry || dependencies.every(d => completed.has(d))) {
      ready.push(stepId);
    }
  }
  return ready;
}

async function executeStep(
  runId: string,
  stepId: string,
  stepDef: StepDef,
  context: Record<string, any>,
): Promise<string | null> {
  const stepRun = db.select().from(workflowStepRuns)
    .where(eq(workflowStepRuns.runId, runId))
    .all()
    .find(s => s.stepId === stepId);
  if (!stepRun) throw new Error(`Step run not found: ${stepId}`);

  // Check condition
  if (stepDef.condition) {
    const condMet = evaluateCondition(stepDef.condition, context);
    if (!condMet) {
      db.update(workflowStepRuns).set({
        status: "skipped", updatedAt: new Date().toISOString(),
      }).where(eq(workflowStepRuns.id, stepRun.id)).run();
      broadcast("workflow_step_update", { runId, stepId, status: "skipped" });
      return null;
    }
  }

  // Resolve template variables in prompt
  const resolvedPrompt = resolveTemplate(stepDef.prompt, context);

  // Mark running
  const now = new Date().toISOString();
  db.update(workflowStepRuns).set({
    status: "running", startedAt: now, updatedAt: now,
    input: JSON.stringify({ prompt: resolvedPrompt }),
  }).where(eq(workflowStepRuns.id, stepRun.id)).run();
  broadcast("workflow_step_update", { runId, stepId, status: "running" });

  // Dispatch task to agent
  const agent = db.select().from(agents).where(eq(agents.id, stepDef.agentId)).get();
  if (!agent) throw new Error(`Agent not found: ${stepDef.agentId}`);

  try {
    const taskId = uuid();
    db.insert(agentTasks).values({
      id: taskId, agentId: stepDef.agentId, prompt: resolvedPrompt,
      status: "queued", createdAt: now,
    }).run();

    // Update step with taskId
    db.update(workflowStepRuns).set({ taskId }).where(eq(workflowStepRuns.id, stepRun.id)).run();

    // Send task to agent via HTTP
    const resp = await fetch(`${agent.url}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": agent.apiKey },
      body: JSON.stringify({ prompt: resolvedPrompt }),
      signal: AbortSignal.timeout((stepDef.timeout || 300) * 1000),
    });

    if (!resp.ok) throw new Error(`Agent returned ${resp.status}`);
    const data = await resp.json();

    // Poll for task completion
    const result = await pollTaskCompletion(agent.url, agent.apiKey, data.task_id || taskId, stepDef.timeout || 300);

    db.update(workflowStepRuns).set({
      status: "completed", output: JSON.stringify(result),
      completedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).where(eq(workflowStepRuns.id, stepRun.id)).run();
    broadcast("workflow_step_update", { runId, stepId, status: "completed" });

    return result;
  } catch (err: any) {
    db.update(workflowStepRuns).set({
      status: "failed", output: JSON.stringify({ error: err.message }),
      completedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).where(eq(workflowStepRuns.id, stepRun.id)).run();
    broadcast("workflow_step_update", { runId, stepId, status: "failed", error: err.message });
    throw err;
  }
}

async function pollTaskCompletion(agentUrl: string, apiKey: string, taskId: string, timeoutSec: number): Promise<string> {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    try {
      const resp = await fetch(`${agentUrl}/api/tasks/${taskId}`, {
        headers: { "X-API-Key": apiKey },
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.status === "completed") return data.result || "";
        if (data.status === "failed") throw new Error(data.error || "Task failed");
      }
    } catch (err: any) {
      if (err.message?.includes("Task failed")) throw err;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("Task timed out");
}

function resolveTemplate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const parts = path.trim().split(".");
    let value: any = context;
    for (const part of parts) {
      if (value == null) return `{{${path}}}`;
      value = value[part];
    }
    return typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  });
}

function broadcast(event: string, data: unknown) {
  sseManager.broadcast(event, data);
  wsManager.broadcast(event, data);
}
