import { useState } from "react";
import { api } from "../api/client";
import type { RegistryPlugin, Agent, DeployResult } from "../lib/types";

interface Props {
  plugin: RegistryPlugin;
  agents: Agent[];
  onRefresh: () => void;
}

type StatusColor = "green" | "red" | "amber" | "gray";

function statusColor(status?: string): StatusColor {
  if (status === "installed") return "green";
  if (status === "failed") return "red";
  if (status === "pending" || status === "updating" || status === "uninstalling") return "amber";
  return "gray";
}

function statusLabel(status?: string) {
  if (!status) return "Not installed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const colorClasses: Record<StatusColor, string> = {
  green: "bg-green-500/20 text-green-400 border-green-500/30",
  red: "bg-red-500/20 text-red-400 border-red-500/30",
  amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  gray: "bg-gray-700/50 text-gray-400 border-gray-600/30",
};

const dotClasses: Record<StatusColor, string> = {
  green: "bg-green-400",
  red: "bg-red-400",
  amber: "bg-amber-400",
  gray: "bg-gray-500",
};

export function RegistryPluginCard({ plugin, agents, onRefresh }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function toggleAgent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(agents.map((a) => a.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function getAgentStatus(agentId: string) {
    return plugin.agents.find((a) => a.agentId === agentId);
  }

  async function doAction(action: "deploy" | "update" | "undeploy") {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showToast("Select at least one agent", false);
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<DeployResult[]>(`/plugin-registry/${plugin.id}/${action}`, {
        agentIds: ids,
      });
      const results = res.data;
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      if (failed === 0) {
        showToast(`${action.charAt(0).toUpperCase() + action.slice(1)} succeeded for ${succeeded} agent(s)`, true);
      } else {
        const firstErr = results.find((r) => !r.success)?.error || "Unknown error";
        showToast(
          `${succeeded} succeeded, ${failed} failed. First error: ${firstErr}`,
          false
        );
      }
      onRefresh();
    } catch (err: any) {
      showToast(err.response?.data?.error || `${action} failed`, false);
    } finally {
      setBusy(false);
    }
  }

  // Determine which actions apply to selected agents
  const selectedAgents = agents.filter((a) => selectedIds.has(a.id));
  const hasUninstalled = selectedAgents.some((a) => {
    const s = getAgentStatus(a.id);
    return !s || s.status === "failed";
  });
  const hasInstalled = selectedAgents.some((a) => {
    const s = getAgentStatus(a.id);
    return s?.status === "installed";
  });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4 relative">
      {toast && (
        <div
          className={`absolute top-3 right-3 z-10 px-3 py-2 rounded-lg text-xs font-medium border ${
            toast.ok
              ? "bg-green-900/80 text-green-300 border-green-700"
              : "bg-red-900/80 text-red-300 border-red-700"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold text-lg leading-tight">{plugin.name}</h3>
            {plugin.version && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 border border-blue-700/40 rounded">
                v{plugin.version}
              </span>
            )}
            {plugin.repoUrl && (
              <a
                href={plugin.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-blue-400 transition"
              >
                GitHub
              </a>
            )}
          </div>
          {plugin.author && (
            <p className="text-gray-500 text-xs mt-0.5">by {plugin.author}</p>
          )}
        </div>
        <span className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded border border-gray-700 shrink-0">
          {plugin.type}
        </span>
      </div>

      {plugin.description && (
        <p className="text-gray-400 text-sm leading-relaxed">{plugin.description}</p>
      )}

      {/* Agent List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Agents</span>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-blue-400 hover:text-blue-300 transition"
            >
              Select all
            </button>
            <span className="text-gray-600">|</span>
            <button
              onClick={deselectAll}
              className="text-xs text-gray-400 hover:text-gray-300 transition"
            >
              Deselect all
            </button>
          </div>
        </div>

        {agents.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No agents registered.</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {agents.map((agent) => {
              const agentStatus = getAgentStatus(agent.id);
              const color = statusColor(agentStatus?.status);
              return (
                <label
                  key={agent.id}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(agent.id)}
                    onChange={() => toggleAgent(agent.id)}
                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0"
                  />
                  <span className="text-sm text-gray-300 flex-1 truncate group-hover:text-white transition">
                    {agent.name}
                  </span>
                  <span
                    className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${colorClasses[color]}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dotClasses[color]}`} />
                    {statusLabel(agentStatus?.status)}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-800">
        {hasUninstalled && (
          <button
            onClick={() => doAction("deploy")}
            disabled={busy || selectedIds.size === 0}
            className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white text-xs font-medium transition"
          >
            {busy ? "..." : "Deploy"}
          </button>
        )}
        {hasInstalled && (
          <>
            <button
              onClick={() => doAction("update")}
              disabled={busy || selectedIds.size === 0}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white text-xs font-medium transition"
            >
              {busy ? "..." : "Update"}
            </button>
            <button
              onClick={() => doAction("undeploy")}
              disabled={busy || selectedIds.size === 0}
              className="px-3 py-1.5 bg-red-800 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white text-xs font-medium transition"
            >
              {busy ? "..." : "Uninstall"}
            </button>
          </>
        )}
        {selectedIds.size === 0 && (
          <span className="text-xs text-gray-500 italic self-center">Select agents to act</span>
        )}
      </div>
    </div>
  );
}
