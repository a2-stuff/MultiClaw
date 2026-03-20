import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { TaskList } from "../components/TaskList";
import { SystemInfo } from "../components/SystemInfo";
import type { AgentDetail as AgentDetailType, Task } from "../lib/types";

const MODEL_OPTIONS = [
  { provider: "anthropic", models: [
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
  ]},
  { provider: "openai", models: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "o3-mini", name: "o3 Mini" },
  ]},
  { provider: "gemini", models: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  ]},
  { provider: "openrouter", models: [
    { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4 (via OR)" },
    { id: "openai/gpt-4o", name: "GPT-4o (via OR)" },
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash (via OR)" },
    { id: "deepseek/deepseek-r1", name: "DeepSeek R1 (via OR)" },
  ]},
  { provider: "deepseek", models: [
    { id: "deepseek-chat", name: "DeepSeek V3" },
    { id: "deepseek-reasoner", name: "DeepSeek R1" },
  ]},
];

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentDetailType | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [prompt, setPrompt] = useState("");
  const [modelSaving, setModelSaving] = useState(false);
  const [modelMsg, setModelMsg] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    api.get(`/agents/${id}`).then((res) => setAgent(res.data));
    api.get(`/agents/${id}/tasks`).then((res) => setTasks(res.data)).catch(() => {});
    // Refresh agent data every 15s to keep system info and status current
    const interval = setInterval(() => {
      api.get(`/agents/${id}`).then((res) => setAgent(res.data)).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [id]);

  const sendTask = async () => {
    if (!prompt.trim()) return;
    await api.post(`/agents/${id}/tasks`, { prompt });
    setPrompt("");
    const res = await api.get(`/agents/${id}/tasks`);
    setTasks(res.data);
  };

  const updateModel = async (provider: string, model: string) => {
    setModelSaving(true);
    setModelMsg("");
    try {
      await api.patch(`/agents/${id}/model`, { provider, model });
      setAgent((prev) => prev ? { ...prev, defaultProvider: provider, defaultModel: model } as AgentDetailType : prev);
      setModelMsg("Saved");
      setTimeout(() => setModelMsg(""), 2000);
    } catch (err: any) {
      setModelMsg(err.response?.data?.error || "Failed");
    } finally {
      setModelSaving(false);
    }
  };

  const selfUpdate = async () => {
    setUpdating(true);
    setUpdateMsg(null);
    try {
      const res = await api.post(`/agents/${id}/self-update`);
      const data = res.data as { status?: string; message?: string; commits?: number };
      if (data.status === "up_to_date" || data.message?.toLowerCase().includes("up to date")) {
        setUpdateMsg({ text: "Already up to date", ok: true });
      } else {
        const commits = data.commits ?? "";
        const detail = commits ? `Updated: ${commits} new commit(s). Restart required.` : (data.message || "Update applied. Restart required.");
        setUpdateMsg({ text: detail, ok: true });
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || "Update failed";
      setUpdateMsg({ text: msg, ok: false });
    } finally {
      setUpdating(false);
      setTimeout(() => setUpdateMsg(null), 6000);
    }
  };

  const restartAgent = async () => {
    if (!confirm("Restart this agent? It will be briefly offline.")) return;
    setRestarting(true);
    try {
      await api.post(`/agents/${id}/restart`);
      setUpdateMsg({ text: "Agent restarting...", ok: true });
      // Poll until agent comes back
      setTimeout(async () => {
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const res = await api.get(`/agents/${id}`);
            if (res.data) {
              setAgent(res.data);
              setUpdateMsg({ text: "Agent restarted successfully", ok: true });
              setTimeout(() => setUpdateMsg(null), 4000);
              break;
            }
          } catch {}
        }
        setRestarting(false);
      }, 2000);
    } catch (err: any) {
      setUpdateMsg({ text: err.response?.data?.error || "Restart failed", ok: false });
      setRestarting(false);
      setTimeout(() => setUpdateMsg(null), 6000);
    }
  };

  if (!agent) return <p className="text-gray-400">Loading...</p>;

  const currentValue = `${agent.defaultProvider ?? "anthropic"}/${agent.defaultModel ?? "claude-sonnet-4-6"}`;

  return (
    <div className="max-w-4xl">
      <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white text-sm mb-4 inline-block">&larr; Back to dashboard</button>

      {/* Agent Header */}
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">{agent.name}</h2>
          <span className="text-sm text-gray-400 capitalize">{agent.status}</span>
        </div>
        <div className="flex items-center gap-3">
          {updateMsg && (
            <span className={`text-xs ${updateMsg.ok ? "text-green-400" : "text-red-400"}`}>
              {updateMsg.text}
            </span>
          )}
          <button
            onClick={selfUpdate}
            disabled={updating}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded-lg text-white text-xs font-medium transition flex items-center gap-1.5"
          >
            {updating ? (
              <>
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Updating...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
                Update Agent Code
              </>
            )}
          </button>
          <button
            onClick={restartAgent}
            disabled={restarting}
            className="px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/30 disabled:bg-gray-800 disabled:text-gray-500 rounded-lg text-orange-400 text-xs font-medium transition flex items-center gap-1.5"
          >
            {restarting ? (
              <>
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Restarting...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                  <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                </svg>
                Restart
              </>
            )}
          </button>
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-6">{agent.url}</p>

      {/* System Info */}
      <div className="mb-6">
        <SystemInfo metadata={agent.metadata ?? null} />
      </div>

      {/* Model Configuration */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h3 className="text-lg font-semibold mb-3">Model Configuration</h3>
        <div className="flex items-center gap-3">
          <select
            value={currentValue}
            onChange={(e) => {
              const [p, ...mParts] = e.target.value.split("/");
              updateModel(p, mParts.join("/"));
            }}
            disabled={modelSaving}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            {MODEL_OPTIONS.map((group) => (
              <optgroup key={group.provider} label={group.provider.charAt(0).toUpperCase() + group.provider.slice(1)}>
                {group.models.map((m) => (
                  <option key={`${group.provider}/${m.id}`} value={`${group.provider}/${m.id}`}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {modelMsg && (
            <span className={`text-xs ${modelMsg === "Saved" ? "text-green-400" : "text-red-400"}`}>
              {modelMsg}
            </span>
          )}
        </div>
      </div>

      {/* Send Task */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3">Send Task</h3>
        <div className="flex gap-2">
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendTask()}
            placeholder="Enter a prompt for this agent..."
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <button onClick={sendTask} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition">Send</button>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-3">Tasks</h3>
      <TaskList tasks={tasks} />
    </div>
  );
}
