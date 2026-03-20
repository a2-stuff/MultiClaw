import { useState, useEffect } from "react";
import { api } from "../api/client";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  agentId: string | null;
  agentName: string | null;
  status: "active" | "revoked";
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface Agent {
  id: string;
  name: string;
}

const statusBadge = {
  active: "bg-green-900 text-green-300",
  revoked: "bg-red-900 text-red-300",
};

export function Keys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAgentId, setNewAgentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const fetchKeys = () => {
    api.get("/keys").then((res) => setKeys(res.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchKeys();
    api.get("/agents").then((res) => setAgents(res.data)).catch(() => {});
  }, []);

  const createKey = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    setCreatedKey(null);
    try {
      const res = await api.post("/keys", {
        name: newName,
        agentId: newAgentId || undefined,
      });
      setCreatedKey(res.data.key);
      setNewName("");
      setNewAgentId("");
      fetchKeys();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create key");
      setTimeout(() => setError(""), 3000);
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    try {
      await api.patch(`/keys/${id}/revoke`);
      setKeys((prev) => prev.map((k) => k.id === id ? { ...k, status: "revoked", revokedAt: new Date().toISOString() } : k));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to revoke");
      setTimeout(() => setError(""), 3000);
    }
  };

  const activateKey = async (id: string) => {
    try {
      await api.patch(`/keys/${id}/activate`);
      setKeys((prev) => prev.map((k) => k.id === id ? { ...k, status: "active", revokedAt: null } : k));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to activate");
      setTimeout(() => setError(""), 3000);
    }
  };

  const deleteKey = async (id: string, name: string) => {
    if (!confirm(`Permanently delete key "${name}"?`)) return;
    try {
      await api.delete(`/keys/${id}`);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete");
      setTimeout(() => setError(""), 3000);
    }
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) return <p className="text-gray-400">Loading keys...</p>;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">API Keys</h2>
        <button
          onClick={() => { setShowCreate(!showCreate); setCreatedKey(null); }}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition"
        >
          + Create Key
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-800 rounded-lg px-4 py-2 mb-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {showCreate && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold mb-3">Create New API Key</h3>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Key name (e.g. Production Agent 1)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
            />
            <select
              value={newAgentId}
              onChange={(e) => setNewAgentId(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">No agent (global)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button
              onClick={createKey}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded-lg text-white text-sm font-medium transition"
            >
              {creating ? "..." : "Create"}
            </button>
          </div>
          {createdKey && (
            <div className="bg-gray-800 rounded-lg p-3 mt-2">
              <p className="text-yellow-300 text-xs mb-1">Copy this key now — it won't be shown again:</p>
              <code className="text-green-300 text-sm font-mono break-all select-all">{createdKey}</code>
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-sm text-gray-400 font-medium">Name</th>
              <th className="text-left px-5 py-3 text-sm text-gray-400 font-medium">Key</th>
              <th className="text-left px-5 py-3 text-sm text-gray-400 font-medium">Agent</th>
              <th className="text-left px-5 py-3 text-sm text-gray-400 font-medium">Status</th>
              <th className="text-left px-5 py-3 text-sm text-gray-400 font-medium">Activity</th>
              <th className="text-right px-5 py-3 text-sm text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-500 text-sm">
                  No API keys created yet.
                </td>
              </tr>
            ) : (
              keys.map((k) => (
                <tr key={k.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-4">
                    <p className="text-white text-sm font-medium">{k.name}</p>
                    <p className="text-gray-500 text-xs">{new Date(k.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-5 py-4">
                    <code className="text-gray-400 text-xs font-mono">{k.keyPrefix}...</code>
                  </td>
                  <td className="px-5 py-4">
                    {k.agentName ? (
                      <span className="text-white text-sm">{k.agentName}</span>
                    ) : (
                      <span className="text-gray-500 text-xs">Global</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${statusBadge[k.status]}`}>
                      {k.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs ${k.lastUsedAt ? "text-green-400" : "text-gray-500"}`}>
                      {k.lastUsedAt ? timeAgo(k.lastUsedAt) : "Never used"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {k.status === "active" ? (
                        <button
                          onClick={() => revokeKey(k.id)}
                          className="text-yellow-400 hover:text-yellow-300 text-xs transition"
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => activateKey(k.id)}
                          className="text-green-400 hover:text-green-300 text-xs transition"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => deleteKey(k.id, k.name)}
                        className="text-red-400 hover:text-red-300 text-xs transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
