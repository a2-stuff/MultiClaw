import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import type { RegistryPlugin, Agent } from "../lib/types";
import { RegistryPluginCard } from "../components/RegistryPluginCard";
import { AddPluginModal } from "../components/AddPluginModal";

export function Plugins() {
  const [registryPlugins, setRegistryPlugins] = useState<RegistryPlugin[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [registryRes, agentsRes] = await Promise.allSettled([
        api.get<RegistryPlugin[]>("/plugin-registry"),
        api.get<Agent[]>("/agents"),
      ]);
      if (registryRes.status === "fulfilled") setRegistryPlugins(registryRes.value.data);
      if (agentsRes.status === "fulfilled") setAgents(agentsRes.value.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const refreshRegistry = useCallback(async () => {
    try {
      const res = await api.get<RegistryPlugin[]>("/plugin-registry");
      setRegistryPlugins(res.data);
    } catch {
      // Error toast shown automatically via global API error handler
    }
  }, []);

  if (loading) return <p className="text-gray-400">Loading plugins...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Plugin Registry</h2>
          <p className="text-gray-400 text-sm mt-1">
            Deploy plugins to your agents.
          </p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition"
        >
          + Add Plugin
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search plugins..."
        className="w-full mb-4 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
      />

      {registryPlugins.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400 mb-2">No plugins in the registry yet.</p>
          <p className="text-gray-500 text-sm">
            Add a plugin to deploy it across your agents.
          </p>
        </div>
      ) : (() => {
        const q = search.toLowerCase();
        const filtered = q
          ? registryPlugins.filter((p) =>
              p.name.toLowerCase().includes(q) ||
              p.slug.toLowerCase().includes(q) ||
              (p.description ?? "").toLowerCase().includes(q) ||
              (p.author ?? "").toLowerCase().includes(q)
            )
          : registryPlugins;
        return filtered.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No plugins match "{search}"</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((plugin) => (
              <RegistryPluginCard
                key={plugin.id}
                plugin={plugin}
                agents={agents}
                onRefresh={refreshRegistry}
              />
            ))}
          </div>
        );
      })()}

      <AddPluginModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={() => {
          setAddModalOpen(false);
          refreshRegistry();
        }}
      />
    </div>
  );
}
