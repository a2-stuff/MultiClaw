import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import type { AgentTemplate, TemplateFormData } from "../lib/templateTypes";

const EMPTY_FORM: TemplateFormData = { name: "", description: "", provider: "", model: "", systemPrompt: "" };

export function Templates() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "operator";
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<TemplateFormData>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/templates").then(res => setTemplates(res.data)).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const res = await api.put(`/templates/${editingId}`, form);
        setTemplates(prev => prev.map(t => t.id === editingId ? res.data : t));
      } else {
        const res = await api.post("/templates", form);
        setTemplates(prev => [...prev, res.data]);
      }
      setShowCreate(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      await api.delete(`/templates/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete");
    }
  }

  async function handleExport(id: string, name: string) {
    try {
      const res = await api.get(`/templates/${id}/export`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export template");
    }
  }

  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await api.post("/templates/import", data);
        setTemplates(prev => [...prev, res.data]);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to import template");
      }
    };
    input.click();
  }

  function startEdit(t: AgentTemplate) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description || "",
      provider: t.provider || "",
      model: t.model || "",
      systemPrompt: t.systemPrompt || "",
    });
    setShowCreate(true);
    setError("");
  }

  if (loading) return <div className="text-gray-400">Loading templates...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agent Templates</h1>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={handleImport}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700">
              Import
            </button>
            <button onClick={() => { setShowCreate(true); setEditingId(null); setForm({ ...EMPTY_FORM }); setError(""); }}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg">
              New Template
            </button>
          </div>
        )}
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {showCreate && canManage && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">{editingId ? "Edit Template" : "Create Template"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="e.g. Research Agent" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Provider</label>
              <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
                <option value="">Default</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
                <option value="openrouter">OpenRouter</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Model</label>
              <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="e.g. claude-sonnet-4-6" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="What this template is for" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">System Prompt</label>
            <textarea value={form.systemPrompt} onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white h-24 resize-none"
              placeholder="Optional system prompt for agents created from this template" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowCreate(false); setEditingId(null); }}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No templates yet. Create one to get started.</div>
      ) : (
        <div className="grid gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between">
              <div>
                <h3 className="font-medium">{t.name}</h3>
                {t.description && <p className="text-sm text-gray-400 mt-1">{t.description}</p>}
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  {t.provider && <span>Provider: {t.provider}</span>}
                  {t.model && <span>Model: {t.model}</span>}
                  <span>Created: {new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <button onClick={() => { /* Navigate to /agents with spawn modal pre-filled */ window.location.href = `/agents?spawn=true&templateId=${t.id}`; }}
                    className="px-2 py-1 text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded border border-green-900/50">Spawn</button>
                  <button onClick={() => handleExport(t.id, t.name)}
                    className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded border border-gray-700">Export</button>
                  <button onClick={() => startEdit(t)}
                    className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded border border-gray-700">Edit</button>
                  <button onClick={() => handleDelete(t.id)}
                    className="px-2 py-1 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded border border-red-900/50">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
