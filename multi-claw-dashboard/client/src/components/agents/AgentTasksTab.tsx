import { Fragment, useState, useEffect } from "react";
import { api } from "../../api/client";
import type { Agent, Task } from "../../lib/types";

const statusBadge: Record<string, string> = {
  queued: "bg-gray-700 text-gray-300", running: "bg-blue-900 text-blue-300",
  completed: "bg-green-900 text-green-300", failed: "bg-red-900 text-red-300",
  cancelled: "bg-yellow-900 text-yellow-300",
};

export function AgentTasksTab({ agent }: { agent: Agent }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);

  const fetchTasks = (silent = false) => {
    if (!silent) { setLoading(true); setError(""); }
    api.get(`/agents/${agent.id}/tasks`)
      .then((res) => setTasks(res.data.sort((a: Task, b: Task) => b.createdAt.localeCompare(a.createdAt))))
      .catch(() => { if (!silent) setError("Failed to load tasks"); })
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => { fetchTasks(); }, [agent.id]);

  // Poll for updates while any task is running or queued
  useEffect(() => {
    const hasActive = tasks.some((t) => t.status === "running" || t.status === "queued");
    if (!hasActive) return;
    const timer = setInterval(() => fetchTasks(true), 2000);
    return () => clearInterval(timer);
  }, [tasks]);

  const sendTask = async () => {
    if (!prompt.trim()) return;
    setSending(true);
    try {
      await api.post(`/agents/${agent.id}/tasks`, { prompt: prompt.trim() });
      setPrompt("");
      fetchTasks();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to send task");
    } finally {
      setSending(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await api.delete(`/agents/${agent.id}/tasks/${taskId}`);
      fetchTasks();
    } catch {
      setError("Failed to delete task");
    }
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading tasks...</p>;
  if (error && tasks.length === 0) return (
    <div className="text-center py-8">
      <p className="text-red-400 text-sm mb-2">{error}</p>
      <button onClick={() => fetchTasks()} className="text-blue-400 text-sm hover:underline">Retry</button>
    </div>
  );

  return (
    <div>
      {/* Send Task */}
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !sending && sendTask()}
            placeholder="Enter a prompt for this agent..."
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button onClick={sendTask} disabled={sending || !prompt.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-white font-medium transition">
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">No tasks yet.</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">Prompt</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <Fragment key={task.id}>
                  <tr className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}>
                    <td className="px-4 py-3 text-white text-sm max-w-xs truncate">{task.prompt}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[task.status] || "bg-gray-700 text-gray-300"}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{task.createdBy || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(task.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{task.completedAt ? new Date(task.completedAt).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                        className="text-red-400 hover:text-red-300 text-xs transition"
                        title="Delete task"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                  {expandedId === task.id && (
                    <tr className="border-b border-gray-800/50 bg-gray-800/20">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="text-sm mb-2">
                          <span className="text-gray-500">Prompt: </span>
                          <span className="text-gray-300">{task.prompt}</span>
                        </div>
                        {task.result && (
                          <div className="text-sm mb-2">
                            <span className="text-gray-500">Result: </span>
                            <pre className="text-gray-300 mt-1 bg-gray-900 rounded p-2 text-xs overflow-x-auto max-h-48">{task.result}</pre>
                          </div>
                        )}
                        {task.error && (
                          <div className="text-sm">
                            <span className="text-gray-500">Error: </span>
                            <pre className="text-red-400 mt-1 bg-gray-900 rounded p-2 text-xs overflow-x-auto">{task.error}</pre>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
