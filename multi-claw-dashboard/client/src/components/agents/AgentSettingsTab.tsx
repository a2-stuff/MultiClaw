import { useState, useEffect } from "react";
import { api } from "../../api/client";
import type { Agent } from "../../lib/types";

const MODEL_OPTIONS = [
  { provider: "anthropic", models: [
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
  ]},
  { provider: "openai", models: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "o3-mini", name: "o3 Mini" },
  ]},
  { provider: "gemini", models: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  ]},
  { provider: "openrouter", models: [
    { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4 (via OR)" },
    { id: "openai/gpt-4o", name: "GPT-4o (via OR)" },
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash (via OR)" },
    { id: "deepseek/deepseek-r1", name: "DeepSeek R1 (via OR)" },
  ]},
  { provider: "deepseek", models: [
    { id: "deepseek-chat", name: "DeepSeek V3" },
    { id: "deepseek-reasoner", name: "DeepSeek R1" },
  ]},
];

export function AgentSettingsTab({ agent, onAgentUpdated }: { agent: Agent; onAgentUpdated: () => void }) {
  const [name, setName] = useState(agent.name);
  const [url, setUrl] = useState(agent.url);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showKeyConfirm, setShowKeyConfirm] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    setName(agent.name);
    setUrl(agent.url);
    setNewKey(null);
    setShowKeyConfirm(false);
  }, [agent.id, agent.name, agent.url]);

  const showMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const saveName = async () => {
    if (!name.trim() || name === agent.name) return;
    setSaving("name");
    try {
      await api.patch(`/agents/${agent.id}`, { name: name.trim() });
      showMsg("Name updated", "success");
      onAgentUpdated();
    } catch (err: any) {
      showMsg(err.response?.data?.error || "Failed", "error");
    } finally { setSaving(null); }
  };

  const saveUrl = async () => {
    if (!url.trim() || url === agent.url) return;
    setSaving("url");
    try {
      await api.patch(`/agents/${agent.id}`, { url: url.trim() });
      showMsg("URL updated", "success");
      onAgentUpdated();
    } catch (err: any) {
      showMsg(err.response?.data?.error || "Failed", "error");
    } finally { setSaving(null); }
  };

  const currentModelValue = `${agent.defaultProvider}/${agent.defaultModel}`;

  const updateModel = async (value: string) => {
    const [provider, ...modelParts] = value.split("/");
    const model = modelParts.join("/");
    setSaving("model");
    try {
      await api.patch(`/agents/${agent.id}/model`, { provider, model });
      showMsg("Model updated", "success");
      onAgentUpdated();
    } catch (err: any) {
      showMsg(err.response?.data?.error || "Failed", "error");
    } finally { setSaving(null); }
  };

  const regenerateKey = async () => {
    setSaving("key");
    try {
      const res = await api.post(`/agents/${agent.id}/regenerate-key`);
      setNewKey(res.data.apiKey);
      setShowKeyConfirm(false);
      showMsg("API key regenerated", "success");
    } catch (err: any) {
      showMsg(err.response?.data?.error || "Failed", "error");
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === "success" ? "bg-green-900/30 text-green-400 border border-green-800" : "bg-red-900/30 text-red-400 border border-red-800"}`}>
          {msg.text}
        </div>
      )}

      <div>
        <label className="text-sm text-gray-400 block mb-1">Agent Name</label>
        <div className="flex gap-2">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          <button onClick={saveName} disabled={saving === "name" || !name.trim() || name === agent.name}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-white text-sm transition">
            {saving === "name" ? "..." : "Save"}
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-400 block mb-1">Agent URL</label>
        <div className="flex gap-2">
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          <button onClick={saveUrl} disabled={saving === "url" || !url.trim() || url === agent.url}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-white text-sm transition">
            {saving === "url" ? "..." : "Save"}
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-400 block mb-1">Model Configuration</label>
        <select value={currentModelValue}
          onChange={(e) => updateModel(e.target.value)}
          disabled={saving === "model"}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
          {MODEL_OPTIONS.map((group) => (
            <optgroup key={group.provider} label={group.provider.charAt(0).toUpperCase() + group.provider.slice(1)}>
              {group.models.map((m) => (
                <option key={`${group.provider}/${m.id}`} value={`${group.provider}/${m.id}`}>{m.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm text-gray-400 block mb-1">API Key</label>
        {newKey ? (
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-green-400 text-xs mb-1">New API key (shown once):</p>
            <code className="text-yellow-300 text-xs font-mono break-all select-all">{newKey}</code>
          </div>
        ) : showKeyConfirm ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
            <p className="text-red-400 text-sm mb-2">This will invalidate the current key. The agent must be reconfigured.</p>
            <div className="flex gap-2">
              <button onClick={regenerateKey} disabled={saving === "key"}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs transition">
                {saving === "key" ? "..." : "Confirm Regenerate"}
              </button>
              <button onClick={() => setShowKeyConfirm(false)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs transition">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowKeyConfirm(true)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition">
            Regenerate API Key
          </button>
        )}
      </div>

      <div>
        <label className="text-sm text-gray-400 block mb-1">Config Sync</label>
        <div className="bg-gray-800/50 rounded-lg p-3 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${agent.status === "online" ? "bg-green-500" : "bg-gray-500"}`} />
          <span className="text-sm text-gray-300">
            {agent.status === "online"
              ? "API keys synced — agent is online and receiving config updates"
              : "Agent offline — config will sync when agent reconnects"}
          </span>
        </div>
      </div>
    </div>
  );
}
