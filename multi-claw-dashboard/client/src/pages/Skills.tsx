import { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import { useAgents } from "../hooks/useAgents";
import { AddSkillModal } from "../components/AddSkillModal";
import type { Skill } from "../lib/types";

export function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deployingSkillId, setDeployingSkillId] = useState<string | null>(null);
  const [deployStatus, setDeployStatus] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { agents } = useAgents();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchSkills = () => {
    api.get("/skills").then((res) => setSkills(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchSkills(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDeployingSkillId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const deploy = async (skillId: string, agentId: string) => {
    const key = `${skillId}-${agentId}`;
    setDeployStatus((s) => ({ ...s, [key]: "deploying" }));
    try {
      await api.post(`/skills/${skillId}/deploy/${agentId}`);
      setDeployStatus((s) => ({ ...s, [key]: "deployed" }));
    } catch (err: any) {
      setDeployStatus((s) => ({ ...s, [key]: err.response?.data?.error || "failed" }));
    }
    setTimeout(() => setDeployStatus((s) => { const n = { ...s }; delete n[key]; return n; }), 3000);
  };

  const deleteSkill = async (id: string) => {
    try {
      await api.delete(`/skills/${id}`);
      setSkills((s) => s.filter((sk) => sk.id !== id));
    } catch {
      // Error toast shown automatically via global API error handler
    }
    setDeleteConfirm(null);
  };

  const sourceBadge = (skill: Skill) => {
    if (skill.source === "custom") {
      return <span className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">Custom</span>;
    }
    return <span className="text-xs px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded">{skill.source}</span>;
  };

  if (loading) return <p className="text-gray-400">Loading skills...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Skills Library</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{skills.length} skill{skills.length !== 1 ? "s" : ""}</span>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition"
          >
            + Add Skill
          </button>
        </div>
      </div>

      {skills.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400 mb-2">No skills yet.</p>
          <p className="text-gray-500 text-sm">Add skills from providers like ClawHub or upload your own.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <div key={skill.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col">
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-white font-semibold text-lg">{skill.name}</h3>
                {sourceBadge(skill)}
              </div>
              <p className="text-gray-400 text-sm mb-3 flex-1">{skill.description || "No description"}</p>
              {skill.sourceUrl && (
                <a href={skill.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline mb-3 truncate block">
                  {skill.sourceUrl}
                </a>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>v{skill.version}</span>
                <span>{new Date(skill.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1" ref={deployingSkillId === skill.id ? dropdownRef : undefined}>
                  <button
                    onClick={() => setDeployingSkillId(deployingSkillId === skill.id ? null : skill.id)}
                    className="w-full px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white text-xs font-medium transition"
                  >
                    Deploy to Agent
                  </button>
                  {deployingSkillId === skill.id && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden">
                      {agents.length === 0 ? (
                        <p className="px-3 py-2 text-gray-400 text-xs">No agents registered</p>
                      ) : (
                        agents.map((agent) => {
                          const key = `${skill.id}-${agent.id}`;
                          const status = deployStatus[key];
                          return (
                            <button
                              key={agent.id}
                              onClick={() => deploy(skill.id, agent.id)}
                              disabled={status === "deploying"}
                              className="w-full px-3 py-2 text-left text-xs text-white hover:bg-gray-700 flex items-center justify-between transition"
                            >
                              <span>{agent.name}</span>
                              {status === "deploying" && <span className="text-yellow-400">...</span>}
                              {status === "deployed" && <span className="text-green-400">Done</span>}
                              {status && status !== "deploying" && status !== "deployed" && (
                                <span className="text-red-400 truncate max-w-[100px]">{status}</span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                {deleteConfirm === skill.id ? (
                  <div className="flex gap-1">
                    <button onClick={() => deleteSkill(skill.id)} className="px-2 py-1.5 bg-red-600 rounded-lg text-white text-xs">Yes</button>
                    <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1.5 bg-gray-700 rounded-lg text-white text-xs">No</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(skill.id)} className="px-2 py-1.5 bg-gray-700 hover:bg-red-600 rounded-lg text-white text-xs transition">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddSkillModal open={showModal} onClose={() => setShowModal(false)} onSkillAdded={fetchSkills} />
    </div>
  );
}
