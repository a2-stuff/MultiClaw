import { useState, useEffect } from "react";
import { api } from "../api/client";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AddPluginModal({ open, onClose, onAdded }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("");
  const [author, setAuthor] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slugEdited) {
      setSlug(toSlug(name));
    }
  }, [name, slugEdited]);

  function reset() {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setDescription("");
    setVersion("");
    setAuthor("");
    setRepoUrl("");
    setError("");
    setSubmitting(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/plugin-registry", {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        version: version.trim() || undefined,
        author: author.trim() || undefined,
        repoUrl: repoUrl.trim() || undefined,
      });
      reset();
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add plugin.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const inputClass =
    "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500";

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Add Plugin to Registry</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-white text-xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Superpowers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Slug <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. superpowers"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugEdited(true);
              }}
              className={inputClass}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Auto-generated from name. Used as the unique identifier.
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <textarea
              placeholder="What does this plugin do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Version</label>
              <input
                type="text"
                placeholder="e.g. 1.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Author</label>
              <input
                type="text"
                placeholder="e.g. Jesse Vincent"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Repository URL</label>
            <input
              type="url"
              placeholder="https://github.com/user/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !slug.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white text-sm font-medium transition"
            >
              {submitting ? "Adding..." : "Add Plugin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
