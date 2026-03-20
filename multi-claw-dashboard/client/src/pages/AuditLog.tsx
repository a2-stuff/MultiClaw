import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { AuditLogResponse } from "../lib/auditTypes";

const ACTION_GROUPS = [
  { label: "Agents", actions: ["agent.create", "agent.spawn", "agent.stop", "agent.start", "agent.delete", "agent.update"] },
  { label: "Tasks", actions: ["task.create", "task.cancel", "task.complete"] },
  { label: "Skills", actions: ["skill.install", "skill.remove"] },
  { label: "Plugins", actions: ["plugin.install", "plugin.enable", "plugin.disable", "plugin.remove"] },
  { label: "Settings", actions: ["settings.update", "settings.delete"] },
  { label: "Users", actions: ["user.login", "user.create", "user.update", "user.delete"] },
  { label: "Keys", actions: ["key.create", "key.revoke", "key.delete"] },
];

export function AuditLog() {
  const [data, setData] = useState<AuditLogResponse>({ logs: [], total: 0, limit: 50, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { limit: "50", offset: String(page * 50) };
    if (actionFilter) params.action = actionFilter;
    api.get("/audit-logs", { params }).then(res => setData(res.data)).finally(() => setLoading(false));
  }, [actionFilter, page]);

  async function handleExport() {
    try {
      const res = await api.get("/audit-logs/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error handled by global interceptor
    }
  }

  const totalPages = Math.ceil(data.total / 50);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <button onClick={handleExport}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700">
          Export CSV
        </button>
      </div>

      <div className="flex gap-2 items-center">
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }}
          className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white">
          <option value="">All actions</option>
          {ACTION_GROUPS.map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.actions.map(a => <option key={a} value={a}>{a}</option>)}
            </optgroup>
          ))}
        </select>
        <span className="text-sm text-gray-500">{data.total} entries</span>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : data.logs.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No audit log entries found.</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">Actor</th>
                <th className="text-left px-4 py-2">Action</th>
                <th className="text-left px-4 py-2">Target</th>
                <th className="text-left px-4 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map(log => (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{log.actorType}</span>
                    {log.actorId && <span className="ml-1 text-gray-400 text-xs">{log.actorId.slice(0, 8)}</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs">{log.action}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-400">
                    {log.targetType && <span>{log.targetType}:{log.targetId?.slice(0, 8)}</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-400 py-1">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
