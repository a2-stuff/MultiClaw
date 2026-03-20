import { useState, useEffect, useCallback } from "react";
import cronstrue from "cronstrue";
import { api } from "../api/client";
import type { CronJob, Agent } from "../lib/types";
import { CronModal } from "../components/CronModal";

function cronDescription(expr: string): string {
  try { return cronstrue.toString(expr, { use24HourTimeFormat: true }); }
  catch { return expr; }
}

function statusDot(cron: CronJob): string {
  if (!cron.enabled) return "bg-gray-500";
  if (cron.last_exit_code === null) return "bg-amber-500";
  if (cron.last_exit_code === 0) return "bg-green-500";
  return "bg-red-500";
}

function statusLabel(cron: CronJob): string {
  if (!cron.enabled) return "Paused";
  if (cron.last_exit_code === null) return "Never run";
  if (cron.last_exit_code === 0) return "OK";
  return `Exit ${cron.last_exit_code}`;
}

export function Crons() {
  const [crons, setCrons] = useState<CronJob[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [offlineAgents, setOfflineAgents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCron, setEditingCron] = useState<CronJob | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [cronRes, agentRes] = await Promise.all([
        api.get("/crons"), api.get("/agents"),
      ]);
      setCrons(cronRes.data.crons || []);
      setOfflineAgents(cronRes.data.offlineAgents || []);
      setAgents(agentRes.data);
    } catch {
      // Error toast shown automatically via global API error handler
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (cron: CronJob) => {
    if (!confirm(`Delete cron job "${cron.name}"? This will also remove its run history.`)) return;
    setActionLoading(cron.id);
    try {
      await api.delete(`/crons/${cron.agentId}/${cron.id}`);
      showToast("Cron job deleted", "success"); fetchData();
    } catch { showToast("Failed to delete cron job", "error"); }
    finally { setActionLoading(null); }
  };

  const handleToggle = async (cron: CronJob) => {
    setActionLoading(cron.id);
    try {
      await api.put(`/crons/${cron.agentId}/${cron.id}`, { enabled: !cron.enabled });
      showToast(cron.enabled ? "Cron job paused" : "Cron job resumed", "success"); fetchData();
    } catch { showToast("Failed to update cron job", "error"); }
    finally { setActionLoading(null); }
  };

  const handleRunNow = async (cron: CronJob) => {
    setActionLoading(cron.id);
    try {
      await api.post(`/crons/${cron.agentId}/${cron.id}/run`);
      showToast("Cron job triggered", "success"); setTimeout(fetchData, 2000);
    } catch { showToast("Failed to trigger cron job", "error"); }
    finally { setActionLoading(null); }
  };

  if (loading) return <p className="text-gray-400">Loading cron jobs...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold">Cron Jobs</h2>
          <p className="text-gray-500 text-sm mt-1">Scheduled commands running on your agents</p>
        </div>
        <button onClick={() => { setEditingCron(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg">
          + New Cron Job
        </button>
      </div>

      {offlineAgents.length > 0 && (
        <div className="bg-amber-900/30 border border-amber-800 rounded-lg p-3 mb-4 text-amber-300 text-sm">
          {offlineAgents.length} agent{offlineAgents.length !== 1 ? "s" : ""} offline — some cron jobs may not be shown
        </div>
      )}

      {crons.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center mt-4">
          <p className="text-gray-400 mb-2">No cron jobs found.</p>
          <p className="text-gray-500 text-sm">Create a cron job to schedule commands on your agents.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Command</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {crons.map((cron) => (
                <CronRow key={`${cron.agentId}-${cron.id}`} cron={cron}
                  expanded={expandedId === cron.id}
                  onToggleExpand={() => setExpandedId(expandedId === cron.id ? null : cron.id)}
                  onEdit={() => { setEditingCron(cron); setShowModal(true); }}
                  onDelete={() => handleDelete(cron)}
                  onToggle={() => handleToggle(cron)}
                  onRunNow={() => handleRunNow(cron)}
                  actionLoading={actionLoading === cron.id} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-lg text-sm z-50 ${
          toast.type === "success" ? "bg-green-900/80 text-green-300 border border-green-800"
            : "bg-red-900/80 text-red-300 border border-red-800"}`}>
          {toast.message}
        </div>
      )}

      <CronModal open={showModal}
        onClose={() => { setShowModal(false); setEditingCron(null); }}
        onSaved={() => { fetchData(); showToast(editingCron ? "Cron job updated" : "Cron job created", "success"); }}
        agents={agents} editingCron={editingCron} />
    </div>
  );
}

function CronRow({ cron, expanded, onToggleExpand, onEdit, onDelete, onToggle, onRunNow, actionLoading }: {
  cron: CronJob; expanded: boolean; onToggleExpand: () => void;
  onEdit: () => void; onDelete: () => void; onToggle: () => void;
  onRunNow: () => void; actionLoading: boolean;
}) {
  const [showFullOutput, setShowFullOutput] = useState(false);
  return (
    <>
      <tr className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer" onClick={onToggleExpand}>
        <td className="px-4 py-3 text-white font-medium">{cron.name}</td>
        <td className="px-4 py-3 text-gray-400 font-mono text-sm" title={cron.command}>
          {cron.command.length > 40 ? cron.command.slice(0, 40) + "..." : cron.command}
        </td>
        <td className="px-4 py-3 text-gray-400 text-sm">{cron.agentName}</td>
        <td className="px-4 py-3 text-gray-400 text-sm" title={cronDescription(cron.schedule)}>
          <span className="font-mono">{cron.schedule}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusDot(cron)}`} />
            <span className="text-gray-400 text-sm">{statusLabel(cron)}</span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-800/50 bg-gray-800/20">
          <td colSpan={5} className="px-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-500">Last run: </span>
                <span className="text-gray-300">
                  {cron.last_run_at ? `${new Date(cron.last_run_at).toLocaleString()} (exit ${cron.last_exit_code})` : "Never"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Next run: </span>
                <span className="text-gray-300">
                  {cron.next_run_at && cron.enabled ? new Date(cron.next_run_at).toLocaleString() : cron.enabled ? "Pending" : "Paused"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Schedule: </span>
                <span className="text-gray-300">{cronDescription(cron.schedule)} (UTC)</span>
              </div>
              <div>
                <span className="text-gray-500">Created: </span>
                <span className="text-gray-300">{new Date(cron.created_at).toLocaleString()}</span>
              </div>
            </div>
            {cron.last_output && (
              <div className="mb-4">
                <span className="text-gray-500 text-sm">Last output:</span>
                <pre className="bg-gray-900 rounded-lg p-3 mt-1 text-xs text-gray-300 font-mono overflow-x-auto max-h-48">
                  {showFullOutput ? cron.last_output : cron.last_output.slice(0, 500)}
                  {!showFullOutput && cron.last_output.length > 500 && (
                    <button onClick={(e) => { e.stopPropagation(); setShowFullOutput(true); }}
                      className="text-blue-400 ml-2 hover:underline">Show more</button>
                  )}
                </pre>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); onRunNow(); }} disabled={actionLoading}
                className="bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm py-1.5 px-3 rounded-lg disabled:opacity-50">
                {actionLoading ? "..." : "Run Now"}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-1.5 px-3 rounded-lg">Edit</button>
              <button onClick={(e) => { e.stopPropagation(); onToggle(); }} disabled={actionLoading}
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-1.5 px-3 rounded-lg disabled:opacity-50">
                {cron.enabled ? "Pause" : "Resume"}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} disabled={actionLoading}
                className="bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm py-1.5 px-3 rounded-lg disabled:opacity-50">Delete</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
