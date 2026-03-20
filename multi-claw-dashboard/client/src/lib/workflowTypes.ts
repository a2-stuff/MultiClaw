export interface StepDef {
  agentId: string;
  prompt: string;
  next?: string[];
  condition?: string;
  retries?: number;
  timeout?: number;
}

export interface WorkflowDef {
  steps: Record<string, StepDef>;
  entryPoints?: string[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  definition: string; // JSON WorkflowDef
  status: "draft" | "active" | "archived";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  input: string | null;
  output: string | null;
  startedAt: string;
  completedAt: string | null;
  createdBy: string | null;
  steps?: WorkflowStepRun[];
}

export interface WorkflowStepRun {
  id: string;
  runId: string;
  stepId: string;
  agentId: string | null;
  taskId: string | null;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  input: string | null;
  output: string | null;
  startedAt: string | null;
  completedAt: string | null;
}
