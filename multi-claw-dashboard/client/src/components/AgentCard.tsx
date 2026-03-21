import { useState, memo } from "react";
import { api } from "../api/client";
import type { Agent } from "../lib/types";

const statusColors = {
  online: "bg-green-500", offline: "bg-gray-500", busy: "bg-yellow-500", error: "bg-red-500",
};

export const AgentCard = memo(function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const handleUpdate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdating(true);
    setUpdateMsg(null);
    try {
      const res = await api.post(`/agents/${agent.id}/self-update`);
      const data = res.data as { status?: string; message?: string; commits?: number };
      if (data.status === "up_to_date" || data.message?.toLowerCase().includes("up to date")) {
        setUpdateMsg("Up to date");
      } else {
        const commits = data.commits;
        setUpdateMsg(commits ? `+${commits} commits` : "Updated");
      }
    } catch {
      setUpdateMsg("Failed");
    } finally {
      setUpdating(false);
      setTimeout(() => setUpdateMsg(null), 4000);
    }
  };

  return (
    <div onClick={onClick} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 cursor-pointer transition">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-lg">{agent.name}</h3>
        <div className="flex items-center gap-2">
          {updateMsg && (
            <span className="text-xs text-gray-400">{updateMsg}</span>
          )}
          <button
            onClick={handleUpdate}
            disabled={updating}
            title="Update agent code"
            className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition"
          >
            {updating ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            )}
          </button>
          <span className={`w-3 h-3 rounded-full ${statusColors[agent.status]}`} />
        </div>
      </div>
      <p className="text-gray-400 text-sm truncate">{agent.url}</p>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-500 capitalize">{agent.status}</span>
        {agent.lastSeen && <span className="text-xs text-gray-500">Last seen: {new Date(agent.lastSeen).toLocaleTimeString()}</span>}
      </div>
    </div>
  );
});
