import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAgents } from "../hooks/useAgents";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { api } from "../api/client";
import { AgentSidebar } from "../components/agents/AgentSidebar";
import { AgentOverviewTab } from "../components/agents/AgentOverviewTab";
import { AgentSkillsTab } from "../components/agents/AgentSkillsTab";
import { AgentPluginsTab } from "../components/agents/AgentPluginsTab";
import { AgentTasksTab } from "../components/agents/AgentTasksTab";
import { AgentLogsTab } from "../components/agents/AgentLogsTab";
import { AgentCronsTab } from "../components/agents/AgentCronsTab";
import { AgentSettingsTab } from "../components/agents/AgentSettingsTab";
import { AgentIdentityTab } from "../components/agents/AgentIdentityTab";
import { AddAgentModal } from "../components/agents/AddAgentModal";
import { SpawnAgentModal } from "../components/agents/SpawnAgentModal";

const ALL_TABS = ["Overview", "Tasks", "Identity", "Logs", "Skills", "Plugins", "Crons", "Settings"] as const;
type Tab = typeof ALL_TABS[number];

const statusColors: Record<string, string> = {
  online: "bg-green-500 text-green-300", offline: "bg-gray-600 text-gray-300",
  busy: "bg-yellow-500 text-yellow-300", error: "bg-red-500 text-red-300",
};

export function Agents() {
  const { agents, loading } = useAgents();
  const { user } = useAuth();
  const { addToast } = useToast();
  const canManage = user?.role === "admin" || user?.role === "operator";
  const tabs = canManage ? ALL_TABS : ALL_TABS.filter(t => t !== "Crons" && t !== "Settings");

  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedAgent = agents.find((a) => a.id === selectedId) || null;

  const selectAgent = useCallback((id: string) => {
    setSelectedId(id);
    setActiveTab("Overview");
    setDeleteConfirm(false);
  }, []);

  const handleDelete = async () => {
    if (!selectedAgent) return;
    setDeleting(true);
    try {
      await api.delete(`/agents/${selectedAgent.id}`);
      setSelectedId(null);
      setDeleteConfirm(false);
    } catch (err: any) {
      addToast(err.response?.data?.error || "Failed to delete agent", "error");
    } finally { setDeleting(false); }
  };

  const handleAgentUpdated = useCallback(() => {
    // SSE handles status updates every 15s. Name/URL/model changes
    // will appear on the next SSE cycle.
  }, []);

  if (loading) return <p className="text-gray-400">Loading agents...</p>;

  return (
    <div className="flex h-[calc(100vh-65px)] -m-6">
      <AgentSidebar
        agents={agents}
        selectedId={selectedId}
        onSelect={selectAgent}
        onAdd={() => setShowAddModal(true)}
        onSpawn={() => setShowSpawnModal(true)}
        canManage={canManage}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {!selectedAgent ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">
              {agents.length === 0
                ? "No agents registered yet. Click '+ Add' to register your first agent."
                : "Select an agent from the sidebar to view details."}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">{selectedAgent.name}</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[selectedAgent.status] || "bg-gray-600 text-gray-300"}`}>
                  {selectedAgent.status}
                </span>
              </div>
              {canManage && (
                deleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 text-sm">Delete this agent?</span>
                    <button onClick={handleDelete} disabled={deleting}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs transition">
                      {deleting ? "..." : "Yes, Delete"}
                    </button>
                    <button onClick={() => setDeleteConfirm(false)}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs transition">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(true)}
                    className="text-red-400 hover:text-red-300 text-sm transition">Delete Agent</button>
                )
              )}
            </div>

            {/* Offline banner */}
            {selectedAgent.status === "offline" && (
              <div className="bg-amber-900/30 border border-amber-800 rounded-lg p-3 mb-4 text-amber-300 text-sm">
                Agent is offline — data may be stale
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-0 border-b border-gray-800 mb-6">
              {tabs.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm transition ${
                    activeTab === tab
                      ? "text-blue-400 border-b-2 border-blue-400 -mb-px"
                      : "text-gray-500 hover:text-gray-300"
                  }`}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "Overview" && <AgentOverviewTab agent={selectedAgent} />}
            {activeTab === "Skills" && <AgentSkillsTab agent={selectedAgent} canManage={canManage} />}
            {activeTab === "Plugins" && <AgentPluginsTab agent={selectedAgent} canManage={canManage} />}
            {activeTab === "Tasks" && <AgentTasksTab agent={selectedAgent} />}
            {activeTab === "Identity" && <AgentIdentityTab agent={selectedAgent} canManage={canManage} />}
            {activeTab === "Logs" && <AgentLogsTab agent={selectedAgent} />}
            {activeTab === "Crons" && canManage && <AgentCronsTab agent={selectedAgent} />}
            {activeTab === "Settings" && canManage && <AgentSettingsTab agent={selectedAgent} onAgentUpdated={handleAgentUpdated} />}
          </>
        )}
      </div>

      <AddAgentModal open={showAddModal} onClose={() => setShowAddModal(false)} onAgentAdded={() => {}} />
      <SpawnAgentModal open={showSpawnModal} onClose={() => setShowSpawnModal(false)} onSpawned={() => {}} />
    </div>
  );
}
