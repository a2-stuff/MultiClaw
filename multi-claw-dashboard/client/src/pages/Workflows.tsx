import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import type { Workflow, WorkflowRun, WorkflowDef, WorkflowStepRun } from "../lib/workflowTypes";
import type { Agent } from "../lib/types";

type View = "list" | "editor" | "run";

const DEFAULT_DEFINITION: WorkflowDef = {
  steps: {
    step1: {
      agentId: "",
      prompt: "Your prompt here",
      next: [],
    },
  },
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-600",
  active: "bg-green-600",
  archived: "bg-yellow-600",
};

const STEP_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-500",
  running: "bg-blue-500 animate-pulse",
  completed: "bg-green-500",
  failed: "bg-red-500",
  skipped: "bg-yellow-500",
};

export function Workflows() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "operator";

  const [view, setView] = useState<View>("list");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorDescription, setEditorDescription] = useState("");
  const [editorJson, setEditorJson] = useState("");
  const [editorStatus, setEditorStatus] = useState<"draft" | "active" | "archived">("draft");
  const [jsonError, setJsonError] = useState("");
  const [saving, setSaving] = useState(false);

  // Run state
  const [currentRun, setCurrentRun] = useState<WorkflowRun | null>(null);
  const [runInput, setRunInput] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadWorkflows();
    api.get("/agents").then(res => setAgents(res.data)).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function loadWorkflows() {
    setLoading(true);
    try {
      const res = await api.get("/workflows");
      setWorkflows(res.data);
    } catch {
      setError("Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }

  function openEditor(workflow?: Workflow) {
    if (workflow) {
      setEditingId(workflow.id);
      setEditorName(workflow.name);
      setEditorDescription(workflow.description || "");
      setEditorStatus(workflow.status);
      try {
        const parsed = JSON.parse(workflow.definition);
        setEditorJson(JSON.stringify(parsed, null, 2));
      } catch {
        setEditorJson(workflow.definition);
      }
    } else {
      setEditingId(null);
      setEditorName("");
      setEditorDescription("");
      setEditorStatus("draft");
      setEditorJson(JSON.stringify(DEFAULT_DEFINITION, null, 2));
    }
    setJsonError("");
    setView("editor");
  }

  function validateJson(json: string): WorkflowDef | null {
    try {
      const parsed = JSON.parse(json);
      if (!parsed.steps || typeof parsed.steps !== "object") {
        setJsonError("Definition must have a 'steps' object");
        return null;
      }
      for (const [key, step] of Object.entries(parsed.steps) as [string, any][]) {
        if (!step.agentId) {
          setJsonError(`Step '${key}' is missing agentId`);
          return null;
        }
        if (!step.prompt) {
          setJsonError(`Step '${key}' is missing prompt`);
          return null;
        }
      }
      setJsonError("");
      return parsed;
    } catch (e: any) {
      setJsonError(`Invalid JSON: ${e.message}`);
      return null;
    }
  }

  async function handleSave() {
    const def = validateJson(editorJson);
    if (!def) return;

    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const res = await api.put(`/workflows/${editingId}`, {
          name: editorName,
          description: editorDescription || null,
          definition: def,
          status: editorStatus,
        });
        setWorkflows(prev => prev.map(w => w.id === editingId ? res.data : w));
      } else {
        const res = await api.post("/workflows", {
          name: editorName,
          description: editorDescription || null,
          definition: def,
        });
        setWorkflows(prev => [...prev, res.data]);
        setEditingId(res.data.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this workflow?")) return;
    try {
      await api.delete(`/workflows/${id}`);
      setWorkflows(prev => prev.filter(w => w.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete");
    }
  }

  const pollRun = useCallback(async (runId: string) => {
    try {
      const res = await api.get(`/workflows/runs/${runId}`);
      setCurrentRun(res.data);
      if (res.data.status !== "running") {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch {
      // ignore poll errors
    }
  }, []);

  async function handleRun(workflowId: string) {
    let inputObj = undefined;
    if (runInput.trim()) {
      try {
        inputObj = JSON.parse(runInput);
      } catch {
        setError("Invalid JSON input");
        return;
      }
    }
    try {
      const res = await api.post(`/workflows/${workflowId}/run`, { input: inputObj });
      const runId = res.data.runId;
      setView("run");
      setCurrentRun({ id: runId, workflowId, status: "running", input: runInput || null, output: null, startedAt: new Date().toISOString(), completedAt: null, createdBy: null, steps: [] });
      // Start polling
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => pollRun(runId), 5000);
      pollRun(runId);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to start run");
    }
  }

  async function handleCancel(runId: string) {
    try {
      await api.post(`/workflows/runs/${runId}/cancel`);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRun(runId);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to cancel");
    }
  }

  function getStepCount(wf: Workflow): number {
    try {
      const def = JSON.parse(wf.definition);
      return Object.keys(def.steps || {}).length;
    } catch {
      return 0;
    }
  }

  function getAgentName(agentId: string): string {
    return agents.find(a => a.id === agentId)?.name || agentId.slice(0, 8) + "...";
  }

  // --- RENDER ---

  if (loading) {
    return <div className="text-gray-400">Loading workflows...</div>;
  }

  // LIST VIEW
  if (view === "list") {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Workflows</h2>
          {canManage && (
            <button onClick={() => openEditor()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition">
              New Workflow
            </button>
          )}
        </div>
        {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">{error}</div>}
        {workflows.length === 0 ? (
          <div className="text-gray-500 text-center py-12">No workflows yet. Create one to get started.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workflows.map(wf => (
              <div key={wf.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">{wf.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[wf.status]}`}>
                    {wf.status}
                  </span>
                </div>
                {wf.description && <p className="text-gray-400 text-sm mb-3">{wf.description}</p>}
                <div className="text-gray-500 text-xs mb-4">
                  {getStepCount(wf)} step{getStepCount(wf) !== 1 ? "s" : ""} &middot; Updated {new Date(wf.updatedAt).toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditor(wf)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition">
                    Edit
                  </button>
                  {canManage && (
                    <>
                      <button onClick={() => { setEditingId(wf.id); setRunInput(""); handleRun(wf.id); }} className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-sm transition">
                        Run
                      </button>
                      <button onClick={() => handleDelete(wf.id)} className="px-3 py-1.5 bg-red-900 hover:bg-red-800 rounded text-sm transition ml-auto">
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // EDITOR VIEW
  if (view === "editor") {
    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => { setView("list"); setError(""); }} className="text-gray-400 hover:text-white transition text-sm">
            &larr; Back to list
          </button>
          <h2 className="text-2xl font-bold">{editingId ? "Edit Workflow" : "New Workflow"}</h2>
        </div>
        {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">{error}</div>}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: metadata */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
              <input
                value={editorName}
                onChange={e => setEditorName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="My Workflow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <input
                value={editorDescription}
                onChange={e => setEditorDescription(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Optional description"
              />
            </div>
            {editingId && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                <select
                  value={editorStatus}
                  onChange={e => setEditorStatus(e.target.value as any)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            )}

            {/* Agent reference */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Available Agents</label>
              <div className="bg-gray-900 border border-gray-700 rounded p-3 max-h-48 overflow-y-auto">
                {agents.length === 0 ? (
                  <span className="text-gray-500 text-sm">No agents registered</span>
                ) : (
                  agents.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-1 text-sm">
                      <span className="text-gray-300">{a.name}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(a.id)}
                        className="text-xs text-gray-500 hover:text-blue-400 transition font-mono"
                        title="Click to copy ID"
                      >
                        {a.id.slice(0, 8)}...
                      </button>
                    </div>
                  ))
                )}
              </div>
              <p className="text-gray-500 text-xs mt-1">Click an agent ID to copy it for use in step definitions.</p>
            </div>

            {/* Run from editor */}
            {editingId && canManage && (
              <div className="border-t border-gray-800 pt-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Run Input (optional JSON)</label>
                <textarea
                  value={runInput}
                  onChange={e => setRunInput(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono h-20 focus:outline-none focus:border-blue-500"
                  placeholder='{"key": "value"}'
                />
                <button
                  onClick={() => handleRun(editingId)}
                  className="mt-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded text-sm font-medium transition"
                >
                  Run Workflow
                </button>
              </div>
            )}
          </div>

          {/* Right column: JSON editor */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Definition (JSON)</label>
            <textarea
              value={editorJson}
              onChange={e => { setEditorJson(e.target.value); setJsonError(""); }}
              className={`w-full bg-gray-900 border rounded px-3 py-2 text-sm font-mono h-96 focus:outline-none resize-y ${
                jsonError ? "border-red-500" : "border-gray-700 focus:border-blue-500"
              }`}
              spellCheck={false}
            />
            {jsonError && <p className="text-red-400 text-xs mt-1">{jsonError}</p>}

            {/* Step preview */}
            <StepPreview json={editorJson} agents={agents} />

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={saving || !editorName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium transition"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => { setView("list"); setError(""); }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RUN VIEW
  if (view === "run" && currentRun) {
    const runWorkflow = workflows.find(w => w.id === currentRun.workflowId);
    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => { setView("list"); setError(""); if (pollRef.current) clearInterval(pollRef.current); }} className="text-gray-400 hover:text-white transition text-sm">
            &larr; Back to list
          </button>
          <h2 className="text-2xl font-bold">Run: {runWorkflow?.name || "Workflow"}</h2>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            currentRun.status === "running" ? "bg-blue-600 animate-pulse" :
            currentRun.status === "completed" ? "bg-green-600" :
            currentRun.status === "failed" ? "bg-red-600" : "bg-gray-600"
          }`}>
            {currentRun.status}
          </span>
        </div>
        {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Run info */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Run Details</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Run ID</dt>
                <dd className="font-mono text-xs">{currentRun.id}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Started</dt>
                <dd>{new Date(currentRun.startedAt).toLocaleString()}</dd>
              </div>
              {currentRun.completedAt && (
                <div>
                  <dt className="text-gray-500">Completed</dt>
                  <dd>{new Date(currentRun.completedAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
            {currentRun.status === "running" && (
              <button
                onClick={() => handleCancel(currentRun.id)}
                className="mt-4 px-3 py-1.5 bg-red-900 hover:bg-red-800 rounded text-sm transition"
              >
                Cancel Run
              </button>
            )}
          </div>

          {/* Step statuses */}
          <div className="lg:col-span-2">
            <h3 className="font-semibold mb-3">Steps</h3>
            {!currentRun.steps || currentRun.steps.length === 0 ? (
              <div className="text-gray-500 text-sm">Waiting for steps...</div>
            ) : (
              <div className="space-y-2">
                {currentRun.steps.map((step: WorkflowStepRun) => (
                  <StepRunCard key={step.id} step={step} getAgentName={getAgentName} />
                ))}
              </div>
            )}

            {/* Output */}
            {currentRun.output && currentRun.status !== "running" && (
              <div className="mt-6">
                <h3 className="font-semibold mb-2">Output</h3>
                <pre className="bg-gray-900 border border-gray-800 rounded p-3 text-sm font-mono overflow-x-auto max-h-64 overflow-y-auto">
                  {JSON.stringify(JSON.parse(currentRun.output), null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function StepPreview({ json, agents }: { json: string; agents: Agent[] }) {
  let def: WorkflowDef | null = null;
  try {
    def = JSON.parse(json);
  } catch {
    return null;
  }
  if (!def?.steps) return null;

  const entries = Object.entries(def.steps);
  if (entries.length === 0) return null;

  return (
    <div className="mt-3">
      <h4 className="text-sm font-medium text-gray-400 mb-2">Step Overview</h4>
      <div className="space-y-1">
        {entries.map(([key, step]) => {
          const agent = agents.find(a => a.id === step.agentId);
          return (
            <div key={key} className="flex items-center gap-2 text-xs bg-gray-800 rounded px-2 py-1.5">
              <span className="font-mono text-blue-400">{key}</span>
              <span className="text-gray-600">&rarr;</span>
              <span className={agent ? "text-green-400" : "text-red-400"}>
                {agent ? agent.name : (step.agentId ? "Unknown agent" : "No agent")}
              </span>
              {step.condition && <span className="text-yellow-500 ml-auto" title={step.condition}>conditional</span>}
              {step.next && step.next.length > 0 && (
                <span className="text-gray-500 ml-auto">
                  &rarr; {step.next.join(", ")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepRunCard({ step, getAgentName }: { step: WorkflowStepRun; getAgentName: (id: string) => string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded p-3">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STEP_STATUS_COLORS[step.status]}`} />
        <span className="font-mono text-sm text-blue-400">{step.stepId}</span>
        {step.agentId && <span className="text-gray-500 text-xs">{getAgentName(step.agentId)}</span>}
        <span className="text-gray-600 text-xs ml-auto">{step.status}</span>
        <span className="text-gray-600 text-xs">{expanded ? "[-]" : "[+]"}</span>
      </div>
      {expanded && (
        <div className="mt-2 pl-5 space-y-2 text-xs">
          {step.startedAt && (
            <div><span className="text-gray-500">Started:</span> {new Date(step.startedAt).toLocaleString()}</div>
          )}
          {step.completedAt && (
            <div><span className="text-gray-500">Completed:</span> {new Date(step.completedAt).toLocaleString()}</div>
          )}
          {step.input && (
            <div>
              <span className="text-gray-500">Input:</span>
              <pre className="mt-1 bg-gray-800 rounded p-2 overflow-x-auto">{formatJson(step.input)}</pre>
            </div>
          )}
          {step.output && (
            <div>
              <span className="text-gray-500">Output:</span>
              <pre className="mt-1 bg-gray-800 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">{formatJson(step.output)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
