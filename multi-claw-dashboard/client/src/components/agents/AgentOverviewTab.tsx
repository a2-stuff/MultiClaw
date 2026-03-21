import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { SystemInfo } from "../SystemInfo";
import type { Agent, AgentDetail, AgentStats } from "../../lib/types";

const statusBadge: Record<string, string> = {
  online: "bg-green-500 text-green-300", offline: "bg-gray-600 text-gray-300",
  busy: "bg-yellow-500 text-yellow-300", error: "bg-red-500 text-red-300",
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AgentOverviewTab({ agent }: { agent: Agent }) {
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);
  const [containerLogs, setContainerLogs] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [dockerStopping, setDockerStopping] = useState(false);
  const [dockerStarting, setDockerStarting] = useState(false);

  useEffect(() => {
    api.get(`/agents/${agent.id}`).then((res) => setDetail(res.data)).catch(() => {});
    api.get(`/agents/${agent.id}/stats`).then((res) => setStats(res.data)).catch(() => {});
    const interval = setInterval(() => {
      api.get(`/agents/${agent.id}`).then((res) => setDetail(res.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [agent.id]);

  const selfUpdate = async () => {
    setUpdating(true);
    setUpdateMsg(null);
    try {
      const res = await api.post(`/agents/${agent.id}/self-update`);
      const data = res.data as { status?: string; message?: string; commits?: number };
      if (data.status === "up_to_date" || data.message?.toLowerCase().includes("up to date")) {
        setUpdateMsg({ text: "Already up to date", ok: true });
      } else {
        const commits = data.commits ?? "";
        const detail = commits ? `Updated: ${commits} new commit(s). Restart required.` : (data.message || "Update applied. Restart required.");
        setUpdateMsg({ text: detail, ok: true });
      }
    } catch (err: any) {
      setUpdateMsg({ text: err.response?.data?.error || err.response?.data?.message || "Update failed", ok: false });
    } finally {
      setUpdating(false);
      setTimeout(() => setUpdateMsg(null), 6000);
    }
  };

  const restartAgent = async () => {
    if (!confirm("Restart this agent? It will be briefly offline.")) return;
    setRestarting(true);
    try {
      // For spawned agents that are offline, use stop+start instead of proxy
      if (agent.spawnedLocally && !agent.containerId && (agent.status === "offline" || agent.status === "error")) {
        try { await api.post(`/agents/${agent.id}/stop-spawned`); } catch {}
        await new Promise((r) => setTimeout(r, 1000));
        await api.post(`/agents/${agent.id}/start-spawned`);
        setUpdateMsg({ text: "Agent restarting...", ok: true });
      } else {
        await api.post(`/agents/${agent.id}/restart`);
        setUpdateMsg({ text: "Agent restarting...", ok: true });
      }
      setTimeout(async () => {
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const res = await api.get(`/agents/${agent.id}`);
            if (res.data) {
              setDetail(res.data);
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

  const stopAgent = async () => {
    if (!confirm("Stop this agent?")) return;
    setStopping(true);
    try {
      await api.post(`/agents/${agent.id}/stop-spawned`);
      setUpdateMsg({ text: "Agent stopped", ok: true });
      setTimeout(() => setUpdateMsg(null), 4000);
    } catch (err: any) {
      setUpdateMsg({ text: err.response?.data?.error || "Stop failed", ok: false });
      setTimeout(() => setUpdateMsg(null), 6000);
    } finally { setStopping(false); }
  };

  const startAgent = async () => {
    setStarting(true);
    try {
      await api.post(`/agents/${agent.id}/start-spawned`);
      setUpdateMsg({ text: "Agent starting...", ok: true });
      setTimeout(() => setUpdateMsg(null), 4000);
    } catch (err: any) {
      setUpdateMsg({ text: err.response?.data?.error || "Start failed", ok: false });
      setTimeout(() => setUpdateMsg(null), 6000);
    } finally { setStarting(false); }
  };

  const dockerStop = async () => {
    if (!confirm("Stop this container?")) return;
    setDockerStopping(true);
    try {
      await api.post(`/agents/${agent.id}/docker-stop`);
      setUpdateMsg({ text: "Container stopped", ok: true });
      setTimeout(() => setUpdateMsg(null), 4000);
    } catch (err: any) {
      setUpdateMsg({ text: err.response?.data?.error || "Stop failed", ok: false });
      setTimeout(() => setUpdateMsg(null), 6000);
    } finally { setDockerStopping(false); }
  };

  const dockerStart = async () => {
    setDockerStarting(true);
    try {
      await api.post(`/agents/${agent.id}/docker-start`);
      setUpdateMsg({ text: "Container starting...", ok: true });
      setTimeout(() => setUpdateMsg(null), 4000);
    } catch (err: any) {
      setUpdateMsg({ text: err.response?.data?.error || "Start failed", ok: false });
      setTimeout(() => setUpdateMsg(null), 6000);
    } finally { setDockerStarting(false); }
  };

  const fetchContainerLogs = async () => {
    try {
      const res = await api.get(`/agents/${agent.id}/container-logs?tail=200`);
      setContainerLogs(res.data.logs);
      setShowLogs(true);
    } catch (err: any) {
      setUpdateMsg({ text: err.response?.data?.error || "Failed to fetch logs", ok: false });
      setTimeout(() => setUpdateMsg(null), 6000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
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
        {agent.spawnedLocally && !agent.containerId && (
          <>
            {agent.status === "online" || agent.status === "busy" || agent.spawnPid ? (
              <button onClick={stopAgent} disabled={stopping}
                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 disabled:bg-gray-800 rounded-lg text-red-400 text-xs font-medium transition">
                {stopping ? "Stopping..." : "Stop Agent"}
              </button>
            ) : (
              <button onClick={startAgent} disabled={starting}
                className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 disabled:bg-gray-800 rounded-lg text-green-400 text-xs font-medium transition">
                {starting ? "Starting..." : "Start Agent"}
              </button>
            )}
          </>
        )}
        {agent.containerId && (
          <>
            {agent.containerStatus === "running" ? (
              <button onClick={dockerStop} disabled={dockerStopping}
                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 disabled:bg-gray-800 rounded-lg text-red-400 text-xs font-medium transition">
                {dockerStopping ? "Stopping..." : "Stop Container"}
              </button>
            ) : (
              <button onClick={dockerStart} disabled={dockerStarting}
                className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 disabled:bg-gray-800 rounded-lg text-green-400 text-xs font-medium transition">
                {dockerStarting ? "Starting..." : "Start Container"}
              </button>
            )}
            <button onClick={fetchContainerLogs}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs font-medium transition">
              View Logs
            </button>
          </>
        )}
      </div>

      {agent.spawnedLocally && !agent.containerId && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Spawn Info</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Port</span>
              <p className="text-white font-mono">{agent.spawnPort || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500">PID</span>
              <p className="text-white font-mono">{agent.spawnPid || "stopped"}</p>
            </div>
            <div>
              <span className="text-gray-500">Host</span>
              <p className="text-white">{agent.spawnHost || "localhost"}</p>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <span className="text-gray-500">Directory</span>
              <p className="text-white font-mono text-xs break-all">{agent.spawnDir || "—"}</p>
            </div>
          </div>
        </div>
      )}

      {agent.containerId && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Container Info</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Container ID</span>
              <p className="text-white font-mono">{agent.containerId.slice(0, 12)}</p>
            </div>
            <div>
              <span className="text-gray-500">Image</span>
              <p className="text-white font-mono">{agent.containerImage || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500">Status</span>
              <p className={`font-medium ${agent.containerStatus === "running" ? "text-green-400" : "text-gray-400"}`}>
                {agent.containerStatus || "unknown"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Port</span>
              <p className="text-white font-mono">{agent.spawnPort || "—"}</p>
            </div>
          </div>
        </div>
      )}

      {showLogs && containerLogs !== null && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs text-gray-500 uppercase tracking-wider">Container Logs</h4>
            <button onClick={() => setShowLogs(false)}
              className="text-xs text-gray-500 hover:text-gray-300 transition">
              Close
            </button>
          </div>
          <pre className="bg-black/50 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
            {containerLogs || "(no logs)"}
          </pre>
        </div>
      )}

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <span className="text-xs text-gray-500 uppercase">Status</span>
          <div className="mt-1 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[agent.status] || "bg-gray-600 text-gray-300"}`}>
              {agent.status}
            </span>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <span className="text-xs text-gray-500 uppercase">Last Seen</span>
          <p className="text-white text-sm mt-1">{timeAgo(agent.lastSeen)}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <span className="text-xs text-gray-500 uppercase">URL</span>
          <p className="text-white text-sm mt-1 truncate" title={agent.url}>{agent.url}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <span className="text-xs text-gray-500 uppercase">Model</span>
          <p className="text-white text-sm mt-1">{agent.defaultProvider} / {agent.defaultModel}</p>
        </div>
        {stats && (
          <>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <span className="text-xs text-gray-500 uppercase">Skills</span>
              <p className="text-white text-2xl font-bold mt-1">{stats.skillCount}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <span className="text-xs text-gray-500 uppercase">Plugins</span>
              <p className="text-white text-2xl font-bold mt-1">{stats.pluginCount}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <span className="text-xs text-gray-500 uppercase">Total Tasks</span>
              <p className="text-white text-2xl font-bold mt-1">{stats.taskCount}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <span className="text-xs text-gray-500 uppercase">Tasks (24h)</span>
              <p className="text-white text-2xl font-bold mt-1">{stats.recentTaskCount}</p>
            </div>
          </>
        )}
      </div>

      {/* System Info */}
      {detail && <SystemInfo metadata={detail.metadata ?? null} />}
    </div>
  );
}
