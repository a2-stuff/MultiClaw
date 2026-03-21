import { useState, useEffect, useCallback } from "react";
import { api } from "../../api/client";
import type { Agent, AgentPlugin, RegistryPlugin, PluginHealthResult } from "../../lib/types";
import { EnvVarPromptModal } from "./EnvVarPromptModal";

export function AgentPluginsTab({ agent, canManage }: { agent: Agent; canManage: boolean }) {
  const [agentPlugins, setAgentPlugins] = useState<AgentPlugin[]>([]);
  const [registryPlugins, setRegistryPlugins] = useState<RegistryPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInstall, setShowInstall] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  // EnvVar prompt modal state
  const [configPlugin, setConfigPlugin] = useState<RegistryPlugin | null>(null);
  const [deploying, setDeploying] = useState(false);

  // Health check state
  const [healthResults, setHealthResults] = useState<Record<string, PluginHealthResult>>({});
  const [healthChecking, setHealthChecking] = useState<string | null>(null);

  const fetchPlugins = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get(`/agents/${agent.id}/plugins`),
      api.get("/plugin-registry"),
    ])
      .then(([pluginsRes, registryRes]) => {
        setAgentPlugins(pluginsRes.data);
        setRegistryPlugins(registryRes.data);
      })
      .catch(() => setError("Failed to load plugins"))
      .finally(() => setLoading(false));
  }, [agent.id]);

  useEffect(() => { fetchPlugins(); }, [fetchPlugins]);

  const openInstall = async () => {
    try {
      const res = await api.get("/plugin-registry");
      setRegistryPlugins(res.data);
      setShowInstall(true);
    } catch {
      setError("Failed to load plugin registry");
    }
  };

  const handleDeployClick = (registryPlugin: RegistryPlugin) => {
    const manifest = registryPlugin.manifest;
    const hasConfig = manifest && (
      (manifest.envVars?.length ?? 0) > 0 ||
      (manifest.dependencies?.length ?? 0) > 0 ||
      (manifest.systemRequirements?.length ?? 0) > 0
    );

    if (hasConfig) {
      // Show config modal
      setConfigPlugin(registryPlugin);
    } else {
      // Deploy directly (no config needed)
      deployWithEnvVars(registryPlugin, {});
    }
  };

  const deployWithEnvVars = async (registryPlugin: RegistryPlugin, envVars: Record<string, string>) => {
    setDeploying(true);
    setInstalling(registryPlugin.id);
    setError("");
    try {
      const res = await api.post(`/plugin-registry/${registryPlugin.id}/deploy`, {
        agentIds: [agent.id],
        envVars,
      });
      const results = res.data as { agentId: string; success: boolean; error?: string }[];
      const result = results[0];
      if (result && !result.success) {
        setError(`Deploy failed: ${result.error}`);
      } else {
        setShowInstall(false);
        setConfigPlugin(null);
        fetchPlugins();
      }
    } catch (err: any) {
      const errData = err.response?.data;
      if (errData?.missing) {
        const names = errData.missing.map((d: { slug: string }) => d.slug).join(", ");
        setError(`Missing dependencies: ${names}. Install them first.`);
      } else {
        setError(errData?.error || "Failed to deploy plugin");
      }
    } finally {
      setDeploying(false);
      setInstalling(null);
    }
  };

  const checkHealth = async (registryPlugin: RegistryPlugin) => {
    setHealthChecking(registryPlugin.slug);
    try {
      const res = await api.get(`/plugin-registry/${registryPlugin.id}/health/${agent.id}`);
      setHealthResults((prev) => ({ ...prev, [registryPlugin.slug]: res.data }));
    } catch {
      setHealthResults((prev) => ({
        ...prev,
        [registryPlugin.slug]: { healthy: false, checks: [{ type: "error", description: "Agent unreachable", passed: false }] },
      }));
    } finally {
      setHealthChecking(null);
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

  // Build set of already-deployed registry plugin slugs/names for this agent
  const deployedOnAgent = new Set(
    registryPlugins
      .filter((rp) => rp.agents.some((a) => a.agentId === agent.id && a.status === "installed"))
      .map((rp) => rp.id)
  );
  const installedPluginNames = new Set(agentPlugins.map((p) => p.pluginName.toLowerCase()));

  // Match agent plugins to registry plugins for health checks (by slug, regardless of deploy status)
  const pluginToRegistry = new Map<string, RegistryPlugin>();
  for (const rp of registryPlugins) {
    if (rp.slug) {
      pluginToRegistry.set(rp.slug.toLowerCase(), rp);
      // Also map underscore variant (browser_control -> browser-control)
      pluginToRegistry.set(rp.slug.toLowerCase().replace(/-/g, "_"), rp);
    }
  }

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

      {error && agentPlugins.length > 0 && (
        <p className="text-red-400 text-xs mb-3">{error}</p>
      )}

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
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Enabled</th>
                <th className="px-4 py-3">Installed</th>
                {canManage && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {agentPlugins.map((plugin) => {
                const regPlugin = pluginToRegistry.get(plugin.pluginName.toLowerCase());
                const health = healthResults[plugin.pluginName.toLowerCase()];
                const isCheckingHealth = healthChecking === plugin.pluginName.toLowerCase();

                return (
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
                      {regPlugin ? (
                        <button
                          onClick={() => checkHealth(regPlugin)}
                          disabled={isCheckingHealth}
                          className="flex items-center gap-1.5 text-xs transition hover:opacity-80"
                          title={health ? (health.healthy ? "All checks passed" : "Some checks failed") : "Click to check health"}
                        >
                          {isCheckingHealth ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-gray-500 animate-pulse" />
                          ) : health ? (
                            <span className={`w-2.5 h-2.5 rounded-full ${health.healthy ? "bg-green-400" : "bg-red-400"}`} />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                          )}
                          <span className={
                            isCheckingHealth ? "text-gray-500"
                            : health?.healthy ? "text-green-400"
                            : health ? "text-red-400"
                            : "text-gray-500"
                          }>
                            {isCheckingHealth ? "..." : health?.healthy ? "OK" : health ? "Fail" : "Check"}
                          </span>
                        </button>
                      ) : (
                        <span className="text-gray-600 text-xs">-</span>
                      )}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Health check detail tooltip — show when a health result has failures */}
      {Object.entries(healthResults).map(([slug, health]) => {
        if (health.healthy || !health.checks?.length) return null;
        return (
          <div key={slug} className="mt-2 bg-red-950/20 border border-red-900/30 rounded-lg p-3">
            <p className="text-red-400 text-xs font-medium mb-1">Health issues for {slug}:</p>
            {health.checks.filter((c) => !c.passed).map((c, i) => (
              <p key={i} className="text-red-400/70 text-xs ml-2">
                - {c.description}{c.error ? `: ${c.error}` : ""}
              </p>
            ))}
          </div>
        );
      })}

      {/* Install modal */}
      {showInstall && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowInstall(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-1">Install Plugin on {agent.name}</h3>
            <p className="text-gray-500 text-xs mb-4">Plugins from the registry will be deployed to this agent.</p>

            {registryPlugins.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No plugins in the registry. Add plugins from the Plugin Registry page first.</p>
            ) : (
              <div className="space-y-2">
                {registryPlugins.map((rp) => {
                  const alreadyDeployed = deployedOnAgent.has(rp.id) || installedPluginNames.has(rp.slug?.toLowerCase());
                  const isInstalling = installing === rp.id;
                  const hasManifest = rp.manifest && (
                    (rp.manifest.envVars?.length ?? 0) > 0 ||
                    (rp.manifest.dependencies?.length ?? 0) > 0
                  );

                  return (
                    <div key={rp.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{rp.name}</span>
                          <span className="text-gray-600 text-xs">v{rp.version}</span>
                          {rp.type === "git-plugin" && (
                            <span className="text-xs text-blue-400/60 bg-blue-900/20 px-1.5 py-0.5 rounded">git</span>
                          )}
                          {hasManifest && (
                            <span className="text-xs text-amber-400/60 bg-amber-900/20 px-1.5 py-0.5 rounded">config</span>
                          )}
                        </div>
                        {rp.description && (
                          <p className="text-gray-500 text-xs mt-0.5 truncate">{rp.description}</p>
                        )}
                      </div>
                      <div className="ml-3 flex-shrink-0">
                        {alreadyDeployed ? (
                          <span className="text-green-400 text-xs">Installed</span>
                        ) : (
                          <button
                            onClick={() => handleDeployClick(rp)}
                            disabled={!!installing}
                            className="text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-1 rounded-lg transition"
                          >
                            {isInstalling ? "Deploying..." : "Deploy"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setShowInstall(false)}
              className="w-full mt-4 text-sm text-gray-400 hover:text-gray-300 py-2 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* EnvVar configuration modal */}
      {configPlugin && (
        <EnvVarPromptModal
          open={!!configPlugin}
          plugin={configPlugin}
          agentId={agent.id}
          agentName={agent.name}
          allPlugins={registryPlugins}
          onClose={() => setConfigPlugin(null)}
          onDeploy={(envVars) => deployWithEnvVars(configPlugin, envVars)}
          deploying={deploying}
        />
      )}
    </div>
  );
}
