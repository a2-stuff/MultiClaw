import { useState, useEffect } from "react";
import { api } from "../../api/client";
import type { Agent, AgentSkill, Skill } from "../../lib/types";

export function AgentSkillsTab({ agent, canManage }: { agent: Agent; canManage: boolean }) {
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDeploy, setShowDeploy] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const fetchSkills = () => {
    setLoading(true);
    setError("");
    api.get(`/agents/${agent.id}/skills`)
      .then((res) => setSkills(res.data))
      .catch(() => setError("Failed to load skills"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSkills(); }, [agent.id]);

  const openDeploy = async () => {
    try {
      const res = await api.get("/skills");
      setAllSkills(res.data);
      setShowDeploy(true);
    } catch {}
  };

  const deploySkill = async (skillId: string) => {
    setDeploying(true);
    try {
      await api.post(`/agents/${agent.id}/skills`, { skillId });
      setShowDeploy(false);
      fetchSkills();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to deploy skill");
    } finally {
      setDeploying(false);
    }
  };

  const removeSkill = async (skillId: string) => {
    try {
      await api.delete(`/agents/${agent.id}/skills/${skillId}`);
      fetchSkills();
    } catch {}
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading skills...</p>;
  if (error && skills.length === 0) return (
    <div className="text-center py-8">
      <p className="text-red-400 text-sm mb-2">{error}</p>
      <button onClick={fetchSkills} className="text-blue-400 text-sm hover:underline">Retry</button>
    </div>
  );

  const installedSkillIds = new Set(skills.map(s => s.skillId));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">{skills.length} skill{skills.length !== 1 ? "s" : ""} installed</span>
        {canManage && (
          <button onClick={openDeploy} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition">
            Deploy Skill
          </button>
        )}
      </div>

      {skills.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">No skills installed on this agent.</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Installed</th>
                {canManage && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => (
                <tr key={skill.id} className="border-b border-gray-800/50">
                  <td className="px-4 py-3 text-white text-sm font-medium">{skill.skillName}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">v{skill.skillVersion}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      skill.status === "installed" ? "bg-green-900/50 text-green-400"
                      : skill.status === "pending" ? "bg-yellow-900/50 text-yellow-400"
                      : "bg-red-900/50 text-red-400"
                    }`}>{skill.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(skill.installedAt).toLocaleDateString()}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => removeSkill(skill.skillId)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDeploy && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowDeploy(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-full max-w-sm max-h-96 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-3">Deploy Skill to {agent.name}</h3>
            {allSkills.filter(s => !installedSkillIds.has(s.id)).length === 0 ? (
              <p className="text-gray-500 text-sm">All available skills are already installed.</p>
            ) : (
              allSkills.filter(s => !installedSkillIds.has(s.id)).map((skill) => (
                <button key={skill.id} onClick={() => deploySkill(skill.id)} disabled={deploying}
                  className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded-lg transition flex items-center justify-between">
                  <div>
                    <span className="text-white text-sm">{skill.name}</span>
                    <span className="text-gray-500 text-xs ml-2">v{skill.version}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
