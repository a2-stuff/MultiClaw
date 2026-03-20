import { useState, useEffect } from "react";
import { api } from "../../api/client";
import type { AgentTemplate } from "../../lib/templateTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  onSpawned: () => void;
}

type SpawnResult =
  | { mode: "process"; port: number; dir: string; pid: number }
  | { mode: "docker"; port: number; containerId: string; agentId: string };

export function SpawnAgentModal({ open, onClose, onSpawned }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [spawning, setSpawning] = useState(false);
  const [result, setResult] = useState<SpawnResult | null>(null);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [useDocker, setUseDocker] = useState(false);
  const [dockerAvailable, setDockerAvailable] = useState<boolean | null>(null);
  const [memoryLimit, setMemoryLimit] = useState("512m");
  const [cpuLimit, setCpuLimit] = useState("1.0");

  useEffect(() => {
    if (open) {
      api.get("/templates").then(res => setTemplates(res.data)).catch(() => {});
      api.get("/agents/docker-status").then(res => setDockerAvailable(res.data.available)).catch(() => setDockerAvailable(false));
    }
  }, [open]);

  const reset = () => {
    setName(""); setError(""); setSpawning(false); setResult(null);
    setSelectedTemplateId(""); setUseDocker(false); setMemoryLimit("512m"); setCpuLimit("1.0");
  };
  const handleClose = () => { reset(); onClose(); };

  const handleSpawn = async () => {
    if (!name.trim()) return;
    setSpawning(true);
    setError("");
    try {
      if (useDocker) {
        const res = await api.post("/agents/spawn-docker", {
          name: name.trim(), memoryLimit, cpuLimit,
        });
        setResult({ mode: "docker", port: res.data.port, containerId: res.data.containerId, agentId: res.data.agentId });
      } else {
        const body: any = { name: name.trim() };
        if (selectedTemplateId) body.templateId = selectedTemplateId;
        const res = await api.post("/agents/spawn", body);
        setResult({ mode: "process", port: res.data.port, dir: res.data.dir, pid: res.data.pid });
      }
      onSpawned();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to spawn agent");
    } finally {
      setSpawning(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {result ? (
          <>
            <h3 className="text-lg font-semibold text-white mb-3">
              Agent Spawned {result.mode === "docker" ? "(Docker)" : "(Process)"}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Port:</span>
                <span className="text-white font-mono">{result.port}</span>
              </div>
              {result.mode === "process" ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">PID:</span>
                    <span className="text-white font-mono">{result.pid}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Directory:</span>
                    <p className="text-white font-mono text-xs mt-1 break-all">{result.dir}</p>
                  </div>
                </>
              ) : (
                <div>
                  <span className="text-gray-400">Container ID:</span>
                  <p className="text-white font-mono text-xs mt-1 break-all">{result.containerId.slice(0, 12)}</p>
                </div>
              )}
            </div>
            <p className="text-green-400 text-xs mt-3">Agent is starting up and will auto-register with the dashboard.</p>
            <button onClick={handleClose} className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition">
              Done
            </button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-white mb-1">Spawn New Agent</h3>
            <p className="text-gray-500 text-xs mb-4">Creates an isolated agent instance on this host with its own skills, plugins, and config.</p>

            {/* Docker toggle */}
            {dockerAvailable && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={useDocker} onChange={e => setUseDocker(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
                <div>
                  <span className="text-sm text-white">Docker Container</span>
                  <p className="text-xs text-gray-500">Run agent in an isolated Docker container</p>
                </div>
              </div>
            )}

            {!useDocker && templates.length > 0 && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">From Template (optional)</label>
                <select value={selectedTemplateId} onChange={e => {
                  setSelectedTemplateId(e.target.value);
                  const t = templates.find(t => t.id === e.target.value);
                  if (t && !name) setName(t.name + " Agent");
                }} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                  <option value="">No template</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Agent Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSpawn()}
                placeholder="e.g. research-bot, code-reviewer"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Docker-specific fields */}
            {useDocker && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Memory Limit</label>
                  <input type="text" value={memoryLimit} onChange={e => setMemoryLimit(e.target.value)}
                    placeholder="512m"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">CPU Limit</label>
                  <input type="text" value={cpuLimit} onChange={e => setCpuLimit(e.target.value)}
                    placeholder="1.0"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={handleClose} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition">Cancel</button>
              <button onClick={handleSpawn} disabled={spawning || !name.trim()}
                className={`flex-1 px-4 py-2 ${useDocker ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"} disabled:bg-gray-700 rounded-lg text-white text-sm font-medium transition`}>
                {spawning ? "Spawning..." : useDocker ? "Spawn (Docker)" : "Spawn Agent"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
