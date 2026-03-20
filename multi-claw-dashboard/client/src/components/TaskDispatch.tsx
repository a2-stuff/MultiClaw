import { useState } from "react";
import { api } from "../api/client";
import type { Agent } from "../lib/types";

interface Props {
  agents: Agent[];
  onDispatched: (orchestrationId: string) => void;
}

export function TaskDispatch({ agents, onDispatched }: Props) {
  const [prompt, setPrompt] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const dispatch = async () => {
    if (!prompt.trim() || selectedAgents.length === 0) return;
    setSending(true);
    setError("");
    try {
      const res = await api.post("/tasks/dispatch", {
        prompt,
        agentIds: selectedAgents,
      });
      onDispatched(res.data.orchestrationId);
      setPrompt("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to dispatch");
    } finally {
      setSending(false);
    }
  };

  const onlineAgents = agents.filter((a) => a.status !== "offline");

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-lg font-semibold mb-3">Dispatch Task</h3>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the task for your agents..."
        rows={4}
        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none mb-3"
      />

      <div className="mb-3">
        <p className="text-sm text-gray-400 mb-2">
          Select agents (order = chain sequence):
        </p>
        <div className="flex flex-wrap gap-2">
          {onlineAgents.map((agent) => {
            const selected = selectedAgents.includes(agent.id);
            const order = selectedAgents.indexOf(agent.id) + 1;
            return (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  selected
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {selected && (
                  <span className="bg-blue-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {order}
                  </span>
                )}
                <span
                  className={`w-2 h-2 rounded-full ${agent.status === "online" ? "bg-green-500" : "bg-yellow-500"}`}
                />
                {agent.name}
                <span className="text-xs text-gray-500">
                  ({(agent as any).defaultModel || "claude-sonnet-4-6"})
                </span>
              </button>
            );
          })}
          {onlineAgents.length === 0 && (
            <p className="text-gray-500 text-sm">No agents online</p>
          )}
        </div>
      </div>

      {selectedAgents.length > 1 && (
        <p className="text-xs text-gray-500 mb-3">
          Chain: {selectedAgents
            .map((id) => agents.find((a) => a.id === id)?.name)
            .join(" \u2192 ")}
        </p>
      )}

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <button
        onClick={dispatch}
        disabled={sending || !prompt.trim() || selectedAgents.length === 0}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-white font-medium transition"
      >
        {sending
          ? "Dispatching..."
          : `Send to ${selectedAgents.length} agent${selectedAgents.length !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
