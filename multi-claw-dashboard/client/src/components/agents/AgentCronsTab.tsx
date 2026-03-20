import { Fragment, useState, useEffect } from "react";
import { api } from "../../api/client";
import type { Agent, CronJob, CronRun } from "../../lib/types";

export function AgentCronsTab({ agent }: { agent: Agent }) {
  const [crons, setCrons] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCrons = () => {
    setLoading(true);
    setError("");
    api.get("/crons")
      .then((res) => {
        const all: CronJob[] = res.data.crons || [];
        setCrons(all.filter(c => c.agentId === agent.id));
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          setError("You don't have permission to view cron jobs.");
        } else {
          setError("Failed to load cron jobs");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCrons(); }, [agent.id]);

  const toggleExpand = async (cron: CronJob) => {
    if (expandedId === cron.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(cron.id);
    setRunsLoading(true);
    try {
      const res = await api.get(`/crons/${cron.agentId}/${cron.id}/runs`);
      setRuns(res.data.runs || res.data || []);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  };

  const handleToggle = async (cron: CronJob) => {
    setActionLoading(cron.id);
    try {
      await api.put(`/crons/${cron.agentId}/${cron.id}`, { enabled: !cron.enabled });
      fetchCrons();
    } catch {}
    finally { setActionLoading(null); }
  };

  const handleRunNow = async (cron: CronJob) => {
    setActionLoading(cron.id);
    try {
      await api.post(`/crons/${cron.agentId}/${cron.id}/run`);
      setTimeout(fetchCrons, 2000);
    } catch {}
    finally { setActionLoading(null); }
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading cron jobs...</p>;
  if (error) return (
    <div className="text-center py-8">
      <p className="text-red-400 text-sm mb-2">{error}</p>
      {!error.includes("permission") && <button onClick={fetchCrons} className="text-blue-400 text-sm hover:underline">Retry</button>}
    </div>
  );

  if (crons.length === 0) return <p className="text-gray-500 text-sm text-center py-6">No cron jobs on this agent.</p>;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Schedule</th>
            <th className="px-4 py-3">Enabled</th>
            <th className="px-4 py-3">Last Run</th>
            <th className="px-4 py-3">Next Run</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {crons.map((cron) => (
            <Fragment key={cron.id}>
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                onClick={() => toggleExpand(cron)}>
                <td className="px-4 py-3 text-white text-sm font-medium">{cron.name}</td>
                <td className="px-4 py-3 text-gray-400 text-sm font-mono">{cron.schedule}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${cron.enabled ? "bg-green-900/50 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                    {cron.enabled ? "Active" : "Paused"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{cron.last_run_at ? new Date(cron.last_run_at).toLocaleString() : "Never"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{cron.next_run_at && cron.enabled ? new Date(cron.next_run_at).toLocaleString() : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleToggle(cron)} disabled={actionLoading === cron.id}
                      className="text-xs text-gray-400 hover:text-white transition disabled:opacity-50">
                      {cron.enabled ? "Pause" : "Resume"}
                    </button>
                    <button onClick={() => handleRunNow(cron)} disabled={actionLoading === cron.id}
                      className="text-xs text-green-400 hover:text-green-300 transition disabled:opacity-50">
                      Run Now
                    </button>
                  </div>
                </td>
              </tr>
              {expandedId === cron.id && (
                <tr className="border-b border-gray-800/50 bg-gray-800/20">
                  <td colSpan={6} className="px-4 py-4">
                    <h4 className="text-xs text-gray-500 uppercase mb-2">Run History</h4>
                    {runsLoading ? (
                      <p className="text-gray-400 text-xs">Loading...</p>
                    ) : runs.length === 0 ? (
                      <p className="text-gray-500 text-xs">No runs yet</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {runs.slice(0, 10).map((run, i) => (
                          <div key={i} className="flex items-center gap-4 text-xs">
                            <span className="text-gray-400">{new Date(run.started_at).toLocaleString()}</span>
                            <span className={run.exit_code === 0 ? "text-green-400" : "text-red-400"}>
                              exit {run.exit_code}
                            </span>
                            <span className="text-gray-500">{run.duration_ms}ms</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
