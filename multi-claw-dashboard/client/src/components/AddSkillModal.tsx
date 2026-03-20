import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { SkillProvider, SkillSearchResult } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSkillAdded: () => void;
}

type Tab = "search" | "url" | "upload";

export function AddSkillModal({ open, onClose, onSkillAdded }: Props) {
  const [tab, setTab] = useState<Tab>("search");
  const [providers, setProviders] = useState<SkillProvider[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<(SkillSearchResult & { providerId: string; providerName: string })[]>([]);
  const [searching, setSearching] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (open) {
      api.get("/skill-providers").then((res) => setProviders(res.data)).catch(() => {});
    }
  }, [open]);

  const doSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError("");
    setSearchResults([]);
    try {
      const results = await Promise.all(
        providers.map((p) =>
          api.get(`/skill-providers/${p.id}/search`, { params: { q: searchQuery } })
            .then((res) => res.data.results.map((r: SkillSearchResult) => ({
              ...r, providerId: p.id, providerName: p.name,
            })))
            .catch(() => [])
        )
      );
      setSearchResults(results.flat());
    } finally { setSearching(false); }
  };

  const addFromSearch = async (result: SkillSearchResult & { providerId: string }) => {
    setError("");
    setSuccess("");
    try {
      const res = await api.post("/skills/import", {
        providerId: result.providerId,
        slug: result.slug,
        name: result.name,
        description: result.description,
      });
      setSuccess(res.data.alreadyExists ? `"${result.name}" was already imported.` : `"${result.name}" added!`);
      onSkillAdded();
    } catch (err: any) {
      setError(err.response?.data?.error || "Import failed");
    }
  };

  const doImportUrl = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post("/skills/import", { url: importUrl });
      const name = res.data.skill?.name || "Skill";
      setSuccess(res.data.alreadyExists ? `"${name}" was already imported.` : `"${name}" added!`);
      setImportUrl("");
      onSkillAdded();
    } catch (err: any) {
      setError(err.response?.data?.error || "Import failed");
    } finally { setImporting(false); }
  };

  const doUpload = async () => {
    if (!uploadFile || !uploadName.trim()) return;
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const form = new FormData();
      form.append("name", uploadName);
      form.append("description", uploadDesc);
      form.append("files", uploadFile);
      await api.post("/skills", form);
      setSuccess(`"${uploadName}" uploaded!`);
      setUploadName("");
      setUploadDesc("");
      setUploadFile(null);
      onSkillAdded();
    } catch (err: any) {
      setError(err.response?.data?.error || "Upload failed");
    } finally { setUploading(false); }
  };

  if (!open) return null;

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition ${
      tab === t ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
    }`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Add Skill</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
          </div>
          <div className="flex gap-2">
            <button className={tabClass("search")} onClick={() => setTab("search")}>Search Providers</button>
            <button className={tabClass("url")} onClick={() => setTab("url")}>Import from URL</button>
            <button className={tabClass("upload")} onClick={() => setTab("upload")}>Upload Custom</button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto max-h-[60vh]">
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          {success && <p className="text-green-400 text-sm mb-3">{success}</p>}

          {tab === "search" && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Search for skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={doSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-white text-sm font-medium"
                >
                  {searching ? "..." : "Search"}
                </button>
              </div>
              {searchResults.length === 0 && !searching && (
                <p className="text-gray-500 text-sm text-center">Search across {providers.length} provider{providers.length !== 1 ? "s" : ""} to find skills.</p>
              )}
              <div className="space-y-2">
                {searchResults.map((r) => (
                  <div key={`${r.providerId}-${r.slug}`} className="flex items-start justify-between bg-gray-800 rounded-lg p-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{r.name}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded">{r.providerName}</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1 truncate">{r.description}</p>
                    </div>
                    <button
                      onClick={() => addFromSearch(r)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white text-xs font-medium shrink-0"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "url" && (
            <div>
              <p className="text-gray-400 text-sm mb-3">Paste a skill URL from a supported provider (e.g., ClawHub, skills.sh).</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://skills.sh/owner/repo/skill-name"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doImportUrl()}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={doImportUrl}
                  disabled={importing || !importUrl.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-white text-sm font-medium"
                >
                  {importing ? "Importing..." : "Import"}
                </button>
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Skill name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
              <div>
                <label className="block text-sm text-gray-400 mb-1">Skill file (.md)</label>
                <input
                  type="file"
                  accept=".md"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setUploadFile(file);
                    if (file && !uploadName) setUploadName(file.name.replace(/\.md$/, ""));
                  }}
                  className="text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-800 file:text-white file:font-medium file:cursor-pointer"
                />
              </div>
              <button
                onClick={doUpload}
                disabled={uploading || !uploadFile || !uploadName.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded-lg text-white text-sm font-medium"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
