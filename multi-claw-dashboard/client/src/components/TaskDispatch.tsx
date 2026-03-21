import { useState, useCallback, useRef } from "react";
import { api } from "../api/client";
import { MentionEditor, type MentionEditorHandle } from "./MentionEditor";
import type { Agent } from "../lib/types";

interface Props {
  agents: Agent[];
  onDispatched: (orchestrationId: string) => void;
}

export function TaskDispatch({ agents, onDispatched }: Props) {
  const [text, setText] = useState("");
  const [mentionedAgentIds, setMentionedAgentIds] = useState<string[]>([]);
  const editorRef = useRef<MentionEditorHandle>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const mentionedAgents = mentionedAgentIds
    .map(id => agents.find(a => a.id === id))
    .filter(Boolean) as Agent[];

  const isDashboardQuery = mentionedAgentIds.length === 0;

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return;
    setSending(true);
    setError("");
    try {
      if (isDashboardQuery) {
        const res = await api.post("/tasks/ask", { prompt: text });
        onDispatched(res.data.orchestrationId);
      } else {
        const res = await api.post("/tasks/dispatch", {
          prompt: text,
          agentIds: mentionedAgentIds,
        });
        onDispatched(res.data.orchestrationId);
      }
      setText("");
      setMentionedAgentIds([]);
      editorRef.current?.clear();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to dispatch");
    } finally {
      setSending(false);
    }
  }, [text, mentionedAgentIds, isDashboardQuery, onDispatched]);

  const removeAgent = (agentId: string) => {
    setMentionedAgentIds(prev => prev.filter(id => id !== agentId));
  };

  const offlineMentioned = mentionedAgents.filter(a => a.status === "offline");

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-lg font-semibold mb-3">Dispatch Task</h3>

      {/* Tag bar */}
      <div className="flex items-center gap-2 mb-2 min-h-[32px] flex-wrap">
        {mentionedAgents.length > 0 ? (
          <>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Dispatching to:</span>
            {mentionedAgents.map(agent => (
              <span
                key={agent.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-900/40 text-blue-400 rounded-full text-xs"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  agent.status === "online" ? "bg-green-500" :
                  agent.status === "busy" ? "bg-yellow-500" :
                  agent.status === "error" ? "bg-red-500" : "bg-gray-500"
                }`} />
                {agent.name}
                <button
                  onClick={() => removeAgent(agent.id)}
                  className="text-gray-500 hover:text-white ml-1"
                >
                  &times;
                </button>
              </span>
            ))}
          </>
        ) : (
          <span className="text-gray-500 text-xs">No agents tagged — Dashboard will answer directly</span>
        )}
      </div>

      {/* Mention editor */}
      <MentionEditor
        ref={editorRef}
        agents={agents}
        onMentionsChange={setMentionedAgentIds}
        onTextChange={setText}
        onSubmit={handleSubmit}
        disabled={sending}
      />

      {/* Offline warning */}
      {offlineMentioned.length > 0 && (
        <p className="text-yellow-400 text-xs mt-2">
          Warning: {offlineMentioned.map(a => a.name).join(", ")} {offlineMentioned.length === 1 ? "is" : "are"} offline and may not respond.
        </p>
      )}

      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

      {/* Send button */}
      <button
        onClick={handleSubmit}
        disabled={sending || !text.trim()}
        className="w-full mt-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-white font-medium transition"
      >
        {sending
          ? "Sending..."
          : isDashboardQuery
            ? "Ask Dashboard"
            : `Dispatch to ${mentionedAgentIds.length} agent${mentionedAgentIds.length !== 1 ? "s" : ""}`}
      </button>

      <p className="text-gray-600 text-xs mt-2 text-center">Cmd+Enter to send</p>
    </div>
  );
}
