import { useState } from "react";
import { api } from "../../api/client";

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAgentAdded: () => void;
}

export function AddAgentModal({ open, onClose, onAgentAdded }: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultKey, setResultKey] = useState<string | null>(null);

  const reset = () => { setName(""); setUrl(""); setError(""); setSaving(false); setResultKey(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) return;
    if (!isValidUrl(url.trim())) {
      setError("URL must be a valid HTTP or HTTPS URL (e.g., http://agent-host:8100)");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/agents", { name: name.trim(), url: url.trim() });
      setResultKey(res.data.apiKey);
      onAgentAdded();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to register agent");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {resultKey ? (
          <>
            <h3 className="text-lg font-semibold text-white mb-3">Agent Registered</h3>
            <p className="text-green-400 text-sm mb-2">Set this as MULTICLAW_AGENT_SECRET in the agent's .env:</p>
            <div className="bg-gray-800 rounded-lg p-3 mb-4">
              <code className="text-yellow-300 text-xs font-mono break-all select-all">{resultKey}</code>
            </div>
            <p className="text-gray-500 text-xs mb-4">This key will not be shown again.</p>
            <button onClick={handleClose} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition">
              Done
            </button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Register New Agent</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-agent"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">URL</label>
                <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://agent-host:8100"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={handleClose} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition">Cancel</button>
              <button onClick={handleSubmit} disabled={saving || !name.trim() || !url.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-white text-sm font-medium transition">
                {saving ? "Registering..." : "Register"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
