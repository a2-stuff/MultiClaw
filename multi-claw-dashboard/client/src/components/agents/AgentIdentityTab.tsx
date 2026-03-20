import { useState, useEffect, useRef } from "react";
import { api } from "../../api/client";
import type { Agent } from "../../lib/types";

export function AgentIdentityTab({ agent, canManage }: { agent: Agent; canManage: boolean }) {
  const [identity, setIdentity] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/agents/${agent.id}`).then((res) => {
      setIdentity(res.data.identity || "");
      setDirty(false);
    }).catch(() => {});
  }, [agent.id]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.patch(`/agents/${agent.id}/identity`, { identity });
      setMsg({ text: "Identity saved and pushed to agent", ok: true });
      setDirty(false);
      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setMsg({ text: err.response?.data?.error || "Failed to save", ok: false });
      setTimeout(() => setMsg(null), 6000);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setIdentity(text);
    setDirty(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const clear = () => {
    setIdentity("");
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Agent Identity</h3>
          <p className="text-gray-500 text-sm mt-1">
            Define this agent's personality, role, and behavior. This is sent as the system prompt for every task.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {msg && (
              <span className={`text-xs ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</span>
            )}
            <label className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs font-medium transition cursor-pointer">
              Upload .md
              <input ref={fileRef} type="file" accept=".md,.txt,.markdown" onChange={handleFileUpload} className="hidden" />
            </label>
            {identity && (
              <button onClick={clear} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-400 text-xs transition">
                Clear
              </button>
            )}
            <button onClick={save} disabled={saving || !dirty}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white text-xs font-medium transition">
              {saving ? "Saving..." : "Save Identity"}
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {canManage ? (
          <textarea
            value={identity}
            onChange={(e) => { setIdentity(e.target.value); setDirty(true); }}
            placeholder="You are a research assistant specialized in..."
            rows={16}
            className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-600 text-sm font-mono resize-y focus:outline-none"
          />
        ) : (
          <div className="px-4 py-3 text-sm text-gray-300 whitespace-pre-wrap font-mono min-h-[200px]">
            {identity || <span className="text-gray-600">No identity configured for this agent.</span>}
          </div>
        )}
      </div>

      {identity && (
        <div className="text-xs text-gray-600">
          {identity.length} characters · {identity.split(/\s+/).filter(Boolean).length} words
        </div>
      )}
    </div>
  );
}
