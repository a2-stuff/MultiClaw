import { useState } from "react";
import type { Agent } from "../../lib/types";

const statusColors = {
  online: "bg-green-500", offline: "bg-gray-500", busy: "bg-yellow-500", error: "bg-red-500",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface Props {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onSpawn: () => void;
  canManage: boolean;
}

export function AgentSidebar({ agents, selectedId, onSelect, onAdd, onSpawn, canManage }: Props) {
  const [search, setSearch] = useState("");
  const filtered = search
    ? agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : agents;

  return (
    <div className="w-64 border-r border-gray-800 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Agents</span>
        {canManage && (
          <div className="flex gap-1">
            <button onClick={onSpawn} className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded transition" title="Spawn local agent">
              Spawn
            </button>
            <button onClick={onAdd} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded transition">
              + Add
            </button>
          </div>
        )}
      </div>
      {agents.length > 5 && (
        <div className="px-3 py-2 border-b border-gray-800">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter agents..."
            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm px-4 py-6 text-center">
            {agents.length === 0 ? "No agents registered" : "No matching agents"}
          </p>
        ) : (
          filtered.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              className={`w-full text-left px-4 py-3 transition ${
                selectedId === agent.id
                  ? "bg-gray-800/60 border-l-2 border-blue-500"
                  : "border-l-2 border-transparent hover:bg-gray-800/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[agent.status]}`} />
                <span className={`font-medium text-sm truncate ${agent.status === "offline" ? "text-gray-500" : "text-white"}`}>
                  {agent.name}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1 ml-4">
                {agent.status === "offline" && agent.lastSeen
                  ? `offline · ${timeAgo(agent.lastSeen)}`
                  : agent.defaultModel || "No model set"}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
