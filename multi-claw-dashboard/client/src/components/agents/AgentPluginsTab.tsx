import { useState, useEffect } from "react";
import { api } from "../../api/client";
import type { Agent, AgentPlugin, Plugin } from "../../lib/types";

export function AgentPluginsTab({ agent, canManage }: { agent: Agent; canManage: boolean }) {
  const [agentPlugins, setAgentPlugins] = useState<AgentPlugin[]>([]);
  const [allPlugins, setAllPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInstall, setShowInstall] = useState(false);
  const [installing, setInstalling] = useState(false);

  const fetchPlugins = () => {
    setLoading(true);
    setError("");
    api.get(`/agents/${agent.id}/plugins`)
      .then((res) => setAgentPlugins(res.data))
      .catch(() => setError("Failed to load plugins"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPlugins(); }, [agent.id]);

  const openInstall = async () => {
    try {
      const res = await api.get("/plugins");
      setAllPlugins(res.data);
      setShowInstall(true);
    } catch {}
  };

  const installPlugin = async (pluginId: string) => {
    setInstalling(true);
    try {
      await api.post(`/agents/${agent.id}/plugins`, { pluginId });
      setShowInstall(false);
      fetchPlugins();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to install plugin");
    } finally {
      setInstalling(false);
    }
  };

  const togglePlugin = async (pluginId: string, enabled: boolean) => {
    try {
      await api.patch(`/agents/${agent.id}/plugins/${pluginId}`, { enabled });
      fetchPlugins();
    } catch {}
  };

  const removePlugin = async (pluginId: string) => {
    try {
      await api.delete(`/agents/${agent.id}/plugins/${pluginId}`);
      fetchPlugins();
    } catch {}
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading plugins...</p>;
  if (error && agentPlugins.length === 0) return (
    <div className="text-center py-8">
      <p className="text-red-400 text-sm mb-2">{error}</p>
      <button onClick={fetchPlugins} className="text-blue-400 text-sm hover:underline">Retry</button>
    </div>
  );

  const installedPluginIds = new Set(agentPlugins.map(p => p.pluginId));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">{agentPlugins.length} plugin{agentPlugins.length !== 1 ? "s" : ""} installed</span>
        {canManage && (
          <button onClick={openInstall} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition">
            Install Plugin
          </button>
        )}
      </div>

      {agentPlugins.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">No plugins installed on this agent.</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Enabled</th>
                <th className="px-4 py-3">Installed</th>
                {canManage && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {agentPlugins.map((plugin) => (
                <tr key={plugin.id} className="border-b border-gray-800/50">
                  <td className="px-4 py-3 text-white text-sm font-medium">{plugin.pluginName}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">v{plugin.pluginVersion}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      plugin.status === "installed" ? "bg-green-900/50 text-green-400"
                      : plugin.status === "pending" ? "bg-yellow-900/50 text-yellow-400"
                      : "bg-red-900/50 text-red-400"
                    }`}>{plugin.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <button
                        onClick={() => togglePlugin(plugin.pluginId, !plugin.enabled)}
                        className={`w-10 h-5 rounded-full transition relative ${plugin.enabled ? "bg-green-600" : "bg-gray-600"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${plugin.enabled ? "left-5" : "left-0.5"}`} />
                      </button>
                    ) : (
                      <span className={`text-xs ${plugin.enabled ? "text-green-400" : "text-gray-500"}`}>
                        {plugin.enabled ? "Yes" : "No"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(plugin.installedAt).toLocaleDateString()}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => removePlugin(plugin.pluginId)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInstall && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowInstall(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-full max-w-sm max-h-96 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-3">Install Plugin on {agent.name}</h3>
            {allPlugins.filter(p => !installedPluginIds.has(p.id)).length === 0 ? (
              <p className="text-gray-500 text-sm">All available plugins are already installed.</p>
            ) : (
              allPlugins.filter(p => !installedPluginIds.has(p.id)).map((plugin) => (
                <button key={plugin.id} onClick={() => installPlugin(plugin.id)} disabled={installing}
                  className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded-lg transition flex items-center justify-between">
                  <div>
                    <span className="text-white text-sm">{plugin.name}</span>
                    <span className="text-gray-500 text-xs ml-2">v{plugin.version}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
