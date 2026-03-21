import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { SharedStateEntry, KnowledgeEntry, SearchResult } from "../lib/memoryTypes";

type Tab = "state" | "knowledge";

// ─── State Tab ───────────────────────────────────────────────────────────────

function StateTab() {
  const [namespace, setNamespace] = useState("default");
  const [entries, setEntries] = useState<{ id: string; key: string; version: number; updatedAt: string; expiresAt: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SharedStateEntry | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newExpiry, setNewExpiry] = useState("");

  function loadEntries() {
    if (!namespace.trim()) return;
    setLoading(true);
    api.get(`/memory/state/${encodeURIComponent(namespace)}`)
      .then(res => setEntries(res.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadEntries(); }, [namespace]);

  async function loadValue(key: string) {
    try {
      const res = await api.get(`/memory/state/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`);
      setSelectedEntry(res.data);
      setEditValue(JSON.stringify(res.data.value, null, 2));
    } catch {
      setSelectedEntry(null);
    }
  }

  async function handleSet() {
    if (!newKey.trim()) return;
    try {
      const parsed = JSON.parse(newValue || "null");
      await api.put(`/memory/state/${encodeURIComponent(namespace)}/${encodeURIComponent(newKey)}`, {
        value: parsed,
        expiresAt: newExpiry || undefined,
      });
      setNewKey("");
      setNewValue("");
      setNewExpiry("");
      loadEntries();
    } catch (err: any) {
      if (err instanceof SyntaxError) alert("Invalid JSON value");
    }
  }

  async function handleUpdate() {
    if (!selectedEntry) return;
    try {
      const parsed = JSON.parse(editValue || "null");
      await api.put(`/memory/state/${encodeURIComponent(namespace)}/${encodeURIComponent(selectedEntry.key)}`, {
        value: parsed,
        version: selectedEntry.version,
      });
      loadEntries();
      loadValue(selectedEntry.key);
    } catch (err: any) {
      if (err instanceof SyntaxError) alert("Invalid JSON value");
    }
  }

  async function handleDelete(key: string) {
    await api.delete(`/memory/state/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`);
    if (selectedEntry?.key === key) setSelectedEntry(null);
    loadEntries();
  }

  return (
    <div className="space-y-4">
      {/* Namespace selector */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-1">Namespace</label>
          <input value={namespace} onChange={e => setNamespace(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white"
            placeholder="default" />
        </div>
        <button onClick={loadEntries}
          className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600">
          Refresh
        </button>
      </div>

      {/* Set new value form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">Set Value</h3>
        <div className="grid grid-cols-3 gap-2">
          <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Key"
            className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white" />
          <input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder='Value (JSON, e.g. "hello" or {"a":1})'
            className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white" />
          <div className="flex gap-2">
            <input value={newExpiry} onChange={e => setNewExpiry(e.target.value)} placeholder="Expires (ISO)"
              className="flex-1 px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white" />
            <button onClick={handleSet}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg whitespace-nowrap">
              Set
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Keys list */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-300">
              Keys {entries.length > 0 && <span className="text-gray-500">({entries.length})</span>}
            </h3>
          </div>
          {loading ? (
            <div className="p-4 text-gray-400 text-sm">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm text-center">No keys in this namespace.</div>
          ) : (
            <div className="divide-y divide-gray-800/50 max-h-96 overflow-y-auto">
              {entries.map(e => (
                <div key={e.id}
                  className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-800/50 flex items-center justify-between ${selectedEntry?.id === e.id ? "bg-gray-800/70" : ""}`}
                  onClick={() => loadValue(e.key)}>
                  <div>
                    <span className="font-mono text-white">{e.key}</span>
                    <span className="ml-2 text-gray-500 text-xs">v{e.version}</span>
                    {e.expiresAt && <span className="ml-2 text-yellow-500 text-xs">expires</span>}
                  </div>
                  <button onClick={(ev) => { ev.stopPropagation(); handleDelete(e.key); }}
                    className="text-red-400 hover:text-red-300 text-xs">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Value viewer/editor */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-300">
              {selectedEntry ? (
                <>
                  <span className="font-mono">{selectedEntry.key}</span>
                  <span className="text-gray-500 ml-2">v{selectedEntry.version}</span>
                </>
              ) : "Select a key"}
            </h3>
          </div>
          {selectedEntry ? (
            <div className="p-4 space-y-3">
              <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={8}
                className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white font-mono resize-y" />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Updated: {new Date(selectedEntry.updatedAt).toLocaleString()}</span>
                {selectedEntry.expiresAt && <span>Expires: {new Date(selectedEntry.expiresAt).toLocaleString()}</span>}
              </div>
              <button onClick={handleUpdate}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg">
                Update
              </button>
            </div>
          ) : (
            <div className="p-4 text-gray-500 text-sm text-center">Click a key to view its value.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Knowledge Tab ───────────────────────────────────────────────────────────

// ─── Knowledge Detail Modal ──────────────────────────────────────────────────

function KnowledgeDetailModal({ entry, onClose, onSaved, onDeleted }: {
  entry: KnowledgeEntry;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: (id: string) => void;
}) {
  const [content, setContent] = useState(entry.content);
  const [metadata, setMetadata] = useState(entry.metadata || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!content.trim()) { setError("Content cannot be empty"); return; }
    setSaving(true);
    setError("");
    try {
      let parsedMeta: any = undefined;
      if (metadata.trim()) {
        try { parsedMeta = JSON.parse(metadata); } catch { setError("Invalid metadata JSON"); setSaving(false); return; }
      }
      await api.put(`/memory/entries/${entry.id}`, { content, metadata: parsedMeta || null });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this knowledge entry?")) return;
    try {
      await api.delete(`/memory/entries/${entry.id}`);
      onDeleted(entry.id);
      onClose();
    } catch {
      setError("Failed to delete");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-bold">Knowledge Entry</h3>
          <div className="flex items-center gap-2">
            {entry.hasEmbedding ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-900 text-green-300">embedding</span>
            ) : (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">no embedding</span>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
          </div>
        </div>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Content</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={10}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white resize-y" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Metadata (JSON)</label>
            <textarea value={metadata} onChange={e => setMetadata(e.target.value)} rows={3}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white font-mono resize-y"
              placeholder='e.g. {"source": "docs", "topic": "api"}' />
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <span className="text-gray-600">ID:</span> <span className="font-mono">{entry.id}</span>
            </div>
            <div>
              <span className="text-gray-600">Created by:</span> {entry.createdBy || "unknown"}
            </div>
            <div>
              <span className="text-gray-600">Created:</span> {new Date(entry.createdAt).toLocaleString()}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
          <button onClick={handleDelete} className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg">
            Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Knowledge Tab ───────────────────────────────────────────────────────────

function KnowledgeTab() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Detail modal
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Ingest
  const [ingestContent, setIngestContent] = useState("");
  const [ingestMetadata, setIngestMetadata] = useState("");
  const [ingesting, setIngesting] = useState(false);

  function loadEntries() {
    setLoading(true);
    api.get("/memory/entries", { params: { limit: 50, offset: page * 50 } })
      .then(res => { setEntries(res.data.entries); setTotal(res.data.total); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadEntries(); }, [page]);

  async function handleSearch() {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    setSearchError("");
    try {
      const res = await api.post("/memory/search", { query: searchQuery, topK: 20 });
      setSearchResults(res.data.results);
    } catch (err: any) {
      setSearchError(err.response?.data?.error || "Search failed");
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  }

  async function handleIngest() {
    if (!ingestContent.trim()) return;
    setIngesting(true);
    try {
      let metadata: any = undefined;
      if (ingestMetadata.trim()) {
        metadata = JSON.parse(ingestMetadata);
      }
      await api.post("/memory/ingest", { content: ingestContent, metadata });
      setIngestContent("");
      setIngestMetadata("");
      loadEntries();
    } catch (err: any) {
      if (err instanceof SyntaxError) alert("Invalid metadata JSON");
    } finally {
      setIngesting(false);
    }
  }

  async function handleDelete(id: string) {
    await api.delete(`/memory/entries/${id}`);
    loadEntries();
    if (searchResults) {
      setSearchResults(searchResults.filter(r => r.id !== id));
    }
  }

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">Semantic Search</h3>
        <div className="flex gap-2">
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search knowledge base..."
            className="flex-1 px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white" />
          <button onClick={handleSearch} disabled={searching}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50">
            {searching ? "Searching..." : "Search"}
          </button>
          {searchResults && (
            <button onClick={() => setSearchResults(null)}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg">
              Clear
            </button>
          )}
        </div>
        {searchError && <p className="text-sm text-red-400">{searchError}</p>}
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-300">
              Search Results <span className="text-gray-500">({searchResults.length})</span>
            </h3>
          </div>
          {searchResults.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm text-center">No results found.</div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {searchResults.map(r => (
                <div key={r.id} className="px-4 py-3 cursor-pointer hover:bg-gray-800/40" onClick={() => setSelectedEntry(r)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white whitespace-pre-wrap break-words">{r.content.slice(0, 300)}{r.content.length > 300 ? "..." : ""}</p>
                      {r.metadata && (
                        <p className="text-xs text-gray-500 mt-1 font-mono">
                          {typeof r.metadata === "string" ? r.metadata : JSON.stringify(r.metadata)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono text-blue-400">{(r.similarity * 100).toFixed(1)}%</span>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ingest form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">Ingest Knowledge</h3>
        <textarea value={ingestContent} onChange={e => setIngestContent(e.target.value)}
          placeholder="Enter content to add to the knowledge base..."
          rows={3}
          className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white resize-y" />
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Metadata (optional JSON)</label>
            <input value={ingestMetadata} onChange={e => setIngestMetadata(e.target.value)}
              placeholder='e.g. {"source": "docs", "topic": "api"}'
              className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white" />
          </div>
          <button onClick={handleIngest} disabled={ingesting || !ingestContent.trim()}
            className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-500 rounded-lg disabled:opacity-50">
            {ingesting ? "Ingesting..." : "Ingest"}
          </button>
        </div>
      </div>

      {/* Entries list */}
      {!searchResults && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">
              All Entries <span className="text-gray-500">({total})</span>
            </h3>
          </div>

          {loading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="text-center text-gray-500 py-12">No knowledge entries yet. Use the ingest form above to add content.</div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="text-left px-4 py-2">Content</th>
                    <th className="text-left px-4 py-2">Metadata</th>
                    <th className="text-left px-4 py-2">Embedding</th>
                    <th className="text-left px-4 py-2">Created</th>
                    <th className="text-left px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer" onClick={() => setSelectedEntry(e)}>
                      <td className="px-4 py-2 max-w-md">
                        <p className="text-white truncate">{e.content.slice(0, 120)}{e.content.length > 120 ? "..." : ""}</p>
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs font-mono max-w-xs truncate">
                        {e.metadata || "-"}
                      </td>
                      <td className="px-4 py-2">
                        {e.hasEmbedding ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-900 text-green-300">yes</span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">no</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-400 whitespace-nowrap text-xs">
                        {new Date(e.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id); }} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50">Prev</button>
              <span className="text-sm text-gray-400 py-1">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50">Next</button>
            </div>
          )}
        </>
      )}

      {/* Detail/Edit Modal */}
      {selectedEntry && (
        <KnowledgeDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onSaved={() => { loadEntries(); }}
          onDeleted={(id) => {
            loadEntries();
            if (searchResults) setSearchResults(searchResults.filter(r => r.id !== id));
          }}
        />
      )}
    </div>
  );
}

// ─── Memory Page ─────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: "state", label: "State" },
  { key: "knowledge", label: "Knowledge" },
];

export function Memory() {
  const [activeTab, setActiveTab] = useState<Tab>("state");

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Memory</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm transition border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-blue-500 text-white font-medium"
                : "border-transparent text-gray-400 hover:text-white"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "state" ? <StateTab /> : <KnowledgeTab />}
    </div>
  );
}
