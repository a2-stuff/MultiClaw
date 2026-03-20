import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgents } from "../hooks/useAgents";
import { AgentCard } from "../components/AgentCard";
import { TaskDispatch } from "../components/TaskDispatch";
import { TaskStream } from "../components/TaskStream";
import { TailscaleDiscovery } from "../components/TailscaleDiscovery";
import { api } from "../api/client";

export function Dashboard() {
  const { agents, loading } = useAgents();
  const navigate = useNavigate();
  const [_lastOrchId, setLastOrchId] = useState<string | null>(null);

  // Add agent modal state
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentUrl, setAgentUrl] = useState("");
  const [addError, setAddError] = useState("");
  const [addResult, setAddResult] = useState<{ apiKey: string } | null>(null);
  const [adding, setAdding] = useState(false);

  const addAgent = async () => {
    if (!agentName.trim() || !agentUrl.trim()) return;
    setAdding(true);
    setAddError("");
    setAddResult(null);
    try {
      const res = await api.post("/agents", { name: agentName, url: agentUrl });
      setAddResult({ apiKey: res.data.apiKey });
      setAgentName("");
      setAgentUrl("");
    } catch (err: any) {
      setAddError(err.response?.data?.error || "Failed to add agent");
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <p className="text-gray-400">Loading agents...</p>;

  return (
    <div className="space-y-6">
      <TaskDispatch
        agents={agents}
        onDispatched={(id) => setLastOrchId(id)}
      />

      <TaskStream />

      <TailscaleDiscovery />

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Agents</h2>
          <div className="flex items-center gap-4">
            <div className="flex gap-3 text-sm text-gray-400">
              <span>
                {agents.filter((a) => a.status !== "offline").length} online
              </span>
              <span>{agents.length} total</span>
            </div>
            <button
              onClick={() => { setShowAddAgent(!showAddAgent); setAddResult(null); setAddError(""); }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition"
            >
              + Add Agent
            </button>
          </div>
        </div>

        {showAddAgent && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
            <h3 className="text-sm font-semibold mb-3">Register New Agent</h3>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Agent name"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="http://agent-host:8100"
                value={agentUrl}
                onChange={(e) => setAgentUrl(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={addAgent}
                disabled={adding || !agentName.trim() || !agentUrl.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded-lg text-white text-sm font-medium transition"
              >
                {adding ? "..." : "Register"}
              </button>
            </div>
            {addError && <p className="text-red-400 text-xs mt-1">{addError}</p>}
            {addResult && (
              <div className="bg-gray-800 rounded-lg p-3 mt-2">
                <p className="text-green-400 text-xs mb-1">Agent registered! Set this as MULTICLAW_AGENT_SECRET in the agent's .env:</p>
                <code className="text-yellow-300 text-xs font-mono break-all select-all">{addResult.apiKey}</code>
              </div>
            )}
          </div>
        )}

        {agents.length === 0 && !showAddAgent ? (
          <p className="text-gray-500">
            No agents registered. Click "Add Agent" to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => navigate(`/agents?id=${agent.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
