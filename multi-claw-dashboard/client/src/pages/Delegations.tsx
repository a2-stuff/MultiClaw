import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import type { AgentPermission, Delegation } from "../lib/delegationTypes";

interface Agent {
  id: string;
  name: string;
}

export function Delegations() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "operator";

  const [agents, setAgents] = useState<Agent[]>([]);
  const [permissions, setPermissions] = useState<AgentPermission[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Permission form state
  const [showPermForm, setShowPermForm] = useState(false);
  const [permForm, setPermForm] = useState({ fromAgentId: "", toAgentId: "", canDelegate: true, canQuery: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/agents").then(res => setAgents(res.data)),
      api.get("/permissions").then(res => setPermissions(res.data)),
      api.get("/delegations").then(res => setDelegations(res.data)),
    ]).finally(() => setLoading(false));
  }, []);

  function agentName(id: string) {
    return agents.find(a => a.id === id)?.name || id.slice(0, 8);
  }

  async function handleCreatePermission() {
    if (!permForm.fromAgentId || !permForm.toAgentId) {
      setError("Select both agents");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/permissions", permForm);
      setPermissions(prev => [...prev, res.data]);
      setShowPermForm(false);
      setPermForm({ fromAgentId: "", toAgentId: "", canDelegate: true, canQuery: true });
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create permission");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePermission(id: string) {
    if (!confirm("Delete this permission?")) return;
    try {
      await api.delete(`/permissions/${id}`);
      setPermissions(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete permission");
    }
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-900/30 text-yellow-400 border-yellow-900/50",
    running: "bg-blue-900/30 text-blue-400 border-blue-900/50",
    completed: "bg-green-900/30 text-green-400 border-green-900/50",
    failed: "bg-red-900/30 text-red-400 border-red-900/50",
  };

  if (loading) return <div className="text-gray-400">Loading delegations...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Delegations</h1>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Permissions Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Agent Permissions</h2>
          {canManage && (
            <button
              onClick={() => { setShowPermForm(true); setError(""); }}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Add Permission
            </button>
          )}
        </div>

        {showPermForm && canManage && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">From Agent</label>
                <select
                  value={permForm.fromAgentId}
                  onChange={e => setPermForm(f => ({ ...f, fromAgentId: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="">Select agent...</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">To Agent</label>
                <select
                  value={permForm.toAgentId}
                  onChange={e => setPermForm(f => ({ ...f, toAgentId: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="">Select agent...</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={permForm.canDelegate}
                  onChange={e => setPermForm(f => ({ ...f, canDelegate: e.target.checked }))}
                  className="rounded bg-gray-900 border-gray-700"
                />
                Can Delegate
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={permForm.canQuery}
                  onChange={e => setPermForm(f => ({ ...f, canQuery: e.target.checked }))}
                  className="rounded bg-gray-900 border-gray-700"
                />
                Can Query
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowPermForm(false)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePermission}
                disabled={saving}
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving..." : "Create"}
              </button>
            </div>
          </div>
        )}

        {permissions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No permissions configured. Add one to enable agent-to-agent communication.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="text-left px-4 py-2">From Agent</th>
                  <th className="text-left px-4 py-2">To Agent</th>
                  <th className="text-left px-4 py-2">Delegate</th>
                  <th className="text-left px-4 py-2">Query</th>
                  <th className="text-left px-4 py-2">Created</th>
                  {canManage && <th className="text-left px-4 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {permissions.map(p => (
                  <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2">{agentName(p.fromAgentId)}</td>
                    <td className="px-4 py-2">{agentName(p.toAgentId)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${p.canDelegate ? "bg-green-900/30 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                        {p.canDelegate ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${p.canQuery ? "bg-green-900/30 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                        {p.canQuery ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    {canManage && (
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleDeletePermission(p.id)}
                          className="px-2 py-1 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded border border-red-900/50"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delegation History Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Delegation History</h2>

        {delegations.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No delegations yet.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="text-left px-4 py-2">From</th>
                  <th className="text-left px-4 py-2">To</th>
                  <th className="text-left px-4 py-2">Mode</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Created</th>
                  <th className="text-left px-4 py-2">Completed</th>
                </tr>
              </thead>
              <tbody>
                {delegations.map(d => (
                  <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2">{agentName(d.fromAgentId)}</td>
                    <td className="px-4 py-2">{agentName(d.toAgentId)}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                        {d.mode}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${statusColors[d.status] || "bg-gray-800 text-gray-300"}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                      {d.completedAt ? new Date(d.completedAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
