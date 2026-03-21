import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../api/client";

const PROVIDERS = [
  { key: "anthropic_api_key", name: "Anthropic", placeholder: "sk-ant-..." },
  { key: "openai_api_key", name: "OpenAI", placeholder: "sk-..." },
  { key: "google_api_key", name: "Google Gemini", placeholder: "AIza..." },
  { key: "openrouter_api_key", name: "OpenRouter", placeholder: "sk-or-..." },
  { key: "deepseek_api_key", name: "DeepSeek", placeholder: "sk-..." },
];

export function Settings() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, { hasValue: boolean; value: string; updatedAt?: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState({ key: "", text: "" });
  const [corsOrigins, setCorsOrigins] = useState<{ protected: string[]; custom: string[] }>({ protected: [], custom: [] });
  const [newOrigin, setNewOrigin] = useState("");
  const [corsError, setCorsError] = useState("");
  const [corsLoading, setCorsLoading] = useState(false);
  const [dockerStatus, setDockerStatus] = useState<any>(null);
  const [dashboardProfile, setDashboardProfile] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [livePreview, setLivePreview] = useState("");

  useEffect(() => {
    api.get("/cors-origins").then((res) => setCorsOrigins(res.data)).catch(() => {});
    api.get("/sandbox/status").then((res) => setDockerStatus(res.data)).catch(() => setDockerStatus({ available: false }));
  }, []);

  const addOrigin = async () => {
    const trimmed = newOrigin.trim();
    if (!trimmed) return;
    setCorsError("");
    setCorsLoading(true);
    try {
      const res = await api.post("/cors-origins", { origin: trimmed });
      setCorsOrigins(res.data);
      setNewOrigin("");
    } catch (err: any) {
      setCorsError(err.response?.data?.error || "Failed to add origin");
    } finally {
      setCorsLoading(false);
    }
  };

  const removeOrigin = async (origin: string) => {
    if (!confirm(`Remove ${origin} from allowed origins?`)) return;
    setCorsError("");
    try {
      const res = await api.delete("/cors-origins", { data: { origin } });
      setCorsOrigins(res.data);
    } catch (err: any) {
      setCorsError(err.response?.data?.error || "Failed to remove origin");
    }
  };

  useEffect(() => {
    api
      .get("/settings")
      .then((res) => {
        const map: Record<string, any> = {};
        for (const s of res.data) {
          map[s.key] = s;
        }
        setExisting(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/settings").then((res) => {
      const profileEntry = res.data.find((s: any) => s.key === "dashboard_profile");
      if (profileEntry?.hasValue) {
        setDashboardProfile(profileEntry.value);
      }
    }).catch(() => {});
    api.get("/settings/dashboard-preview").then((res) => {
      setLivePreview(res.data.preview);
    }).catch(() => {});
  }, []);

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      await api.put("/settings/dashboard_profile", { value: dashboardProfile });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      setMessage({ key: "dashboard_profile", text: err.response?.data?.error || "Failed to save" });
    } finally {
      setProfileSaving(false);
    }
  };

  const saveKey = async (providerKey: string) => {
    const value = keys[providerKey];
    if (!value?.trim()) return;
    setSaving(providerKey);
    setMessage({ key: "", text: "" });
    try {
      await api.put(`/settings/${providerKey}`, { value });
      setMessage({ key: providerKey, text: "Saved and pushed to all agents." });
      setExisting((prev) => ({
        ...prev,
        [providerKey]: { hasValue: true, value: "\u2022\u2022\u2022\u2022\u2022\u2022" + value.slice(-6), updatedAt: new Date().toISOString() },
      }));
      setKeys((prev) => ({ ...prev, [providerKey]: "" }));
    } catch (err: any) {
      setMessage({ key: providerKey, text: err.response?.data?.error || "Failed to save" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-2">Allowed Origins</h3>
        <p className="text-gray-400 text-sm mb-4">
          IPs and domains allowed to connect as agents. Protected origins come from server configuration and cannot be removed.
        </p>
        <div className="space-y-2 mb-4">
          {corsOrigins.protected.map((origin) => (
            <div key={origin} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
              <span className="text-white text-sm font-mono">{origin}</span>
              <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded">Protected</span>
            </div>
          ))}
          {corsOrigins.custom.map((origin) => (
            <div key={origin} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
              <span className="text-white text-sm font-mono">{origin}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded">Custom</span>
                <button
                  onClick={() => removeOrigin(origin)}
                  className="text-gray-500 hover:text-red-400 transition text-sm"
                  title="Remove origin"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
          {corsOrigins.protected.length === 0 && corsOrigins.custom.length === 0 && (
            <p className="text-gray-500 text-sm">No origins configured.</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="https://192.168.1.50:8000"
            value={newOrigin}
            onChange={(e) => { setNewOrigin(e.target.value); setCorsError(""); }}
            onKeyDown={(e) => e.key === "Enter" && addOrigin()}
            className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
          <button
            onClick={addOrigin}
            disabled={corsLoading || !newOrigin.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-white text-sm transition"
          >
            {corsLoading ? "..." : "Add"}
          </button>
        </div>
        {corsError && <p className="mt-2 text-xs text-red-400">{corsError}</p>}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-2">AI Provider API Keys</h3>
        <p className="text-gray-400 text-sm mb-4">
          Keys are pushed to all connected agents. Agents with a key in their .env use their local key instead.
        </p>
        <div className="space-y-4">
          {PROVIDERS.map((provider) => {
            const info = existing[provider.key];
            return (
              <div key={provider.key} className="border-b border-gray-800 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-sm font-medium">{provider.name}</span>
                  {info?.hasValue && (
                    <span className="text-gray-500 text-xs font-mono">{info.value}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={provider.placeholder}
                    value={keys[provider.key] || ""}
                    onChange={(e) => setKeys((prev) => ({ ...prev, [provider.key]: e.target.value }))}
                    className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
                  />
                  <button
                    onClick={() => saveKey(provider.key)}
                    disabled={saving === provider.key || !keys[provider.key]?.trim()}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-white text-sm transition"
                  >
                    {saving === provider.key ? "..." : "Save"}
                  </button>
                </div>
                {message.key === provider.key && (
                  <p className={`mt-1 text-xs ${message.text.includes("Failed") ? "text-red-400" : "text-green-400"}`}>
                    {message.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-2">Dashboard Profile</h3>
        <p className="text-gray-400 text-sm mb-4">
          Custom instructions for the dashboard's AI personality. Used when answering direct queries (no agents tagged) and when synthesizing parallel agent results.
        </p>
        <textarea
          value={dashboardProfile}
          onChange={(e) => { setDashboardProfile(e.target.value); setProfileSaved(false); }}
          placeholder="You are the MultiClaw administrator. Be concise. Prioritize security alerts..."
          rows={5}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none mb-3 font-mono text-sm"
        />
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-500 text-xs">{dashboardProfile.length} characters</span>
          <button
            onClick={saveProfile}
            disabled={profileSaving}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-white text-sm transition"
          >
            {profileSaving ? "Saving..." : profileSaved ? "Saved!" : "Save Profile"}
          </button>
        </div>

        {livePreview && (
          <details className="mt-2">
            <summary className="text-gray-400 text-xs cursor-pointer hover:text-gray-300">
              Auto-injected live context (read-only preview)
            </summary>
            <pre className="mt-2 p-3 bg-gray-800 rounded-lg text-gray-400 text-xs overflow-x-auto whitespace-pre-wrap">
              {livePreview}
            </pre>
          </details>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Account</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Name</span>
            <span className="text-white">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Email</span>
            <span className="text-white">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Role</span>
            <span className="text-white capitalize">{user?.role}</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-3">Docker Sandbox</h3>
        {dockerStatus === null ? (
          <p className="text-gray-500 text-sm">Checking Docker status...</p>
        ) : dockerStatus.available ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-green-400">Docker Available</span>
            </div>
            <div className="text-sm text-gray-400">
              Version: {dockerStatus.serverVersion} | Containers: {dockerStatus.containers} | Images: {dockerStatus.images}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-400">Docker Unavailable — Plugin sandboxing disabled</span>
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">System</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Version</span>
            <span className="text-white">0.1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
