import { useState, useEffect, useRef } from "react";
import { api } from "../../api/client";
import type { Agent } from "../../lib/types";

interface LogEntry {
  timestamp: number;
  level: string;
  logger: string;
  message: string;
}

const levelColors: Record<string, string> = {
  DEBUG: "text-gray-500",
  INFO: "text-blue-400",
  WARNING: "text-yellow-400",
  ERROR: "text-red-400",
  CRITICAL: "text-red-500 font-bold",
};

export function AgentLogsTab({ agent }: { agent: Agent }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (levelFilter) params.set("level", levelFilter);
      const res = await api.get(`/agents/${agent.id}/logs?${params}`);
      setLogs(res.data);
      setError("");
    } catch {
      setError("Failed to fetch logs — agent may be offline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [agent.id, autoRefresh, levelFilter]);

  const filtered = filter
    ? logs.filter((l) => l.message.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const clearLogs = async () => {
    try {
      await api.delete(`/agents/${agent.id}/logs`);
      setLogs([]);
    } catch {}
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter logs..."
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 w-64"
        />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All Levels</option>
          <option value="DEBUG">DEBUG</option>
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="ERROR">ERROR</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded"
          />
          Auto-refresh
        </label>
        <button onClick={fetchLogs} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs transition">
          Refresh
        </button>
        <button onClick={clearLogs} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-red-400 text-xs transition">
          Clear
        </button>
        <span className="text-xs text-gray-600 ml-auto">{filtered.length} entries</span>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading logs...</p>
      ) : error ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
          <p className="text-gray-500 text-sm">{error}</p>
          <button onClick={fetchLogs} className="text-blue-400 text-sm hover:underline mt-2">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
          <p className="text-gray-500 text-sm">No log entries{filter ? " matching filter" : ""}.</p>
        </div>
      ) : (
        <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-y-auto max-h-[calc(100vh-280px)] font-mono text-xs">
            {filtered.map((log, i) => (
              <div key={i} className="px-4 py-1 hover:bg-gray-900/50 border-b border-gray-900/30 flex gap-3">
                <span className="text-gray-600 flex-shrink-0 w-20">{formatTime(log.timestamp)}</span>
                <span className={`flex-shrink-0 w-16 ${levelColors[log.level] || "text-gray-400"}`}>{log.level}</span>
                <span className="text-gray-300 break-all whitespace-pre-wrap">{log.message}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </div>
  );
}
