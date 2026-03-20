import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { Agent, CronJob } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  agents: Agent[];
  editingCron?: CronJob | null;
}

export function CronModal({ open, onClose, onSaved, agents, editingCron }: Props) {
  const [agentId, setAgentId] = useState("");
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [schedule, setSchedule] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingCron) {
      setAgentId(editingCron.agentId);
      setName(editingCron.name);
      setCommand(editingCron.command);
      setSchedule(editingCron.schedule);
      setEnabled(editingCron.enabled);
    } else {
      setAgentId(agents.length === 1 ? agents[0].id : "");
      setName("");
      setCommand("");
      setSchedule("");
      setEnabled(true);
    }
    setError("");
  }, [editingCron, agents, open]);

  const handleSubmit = async () => {
    if (!agentId) { setError("Select an agent"); return; }
    if (!name.trim()) { setError("Name is required"); return; }
    if (!command.trim()) { setError("Command is required"); return; }
    if (!schedule.trim()) { setError("Schedule is required"); return; }

    setSubmitting(true);
    setError("");
    try {
      if (editingCron) {
        await api.put(`/crons/${agentId}/${editingCron.id}`, {
          name: name.trim(), command: command.trim(),
          schedule: schedule.trim(), enabled,
        });
      } else {
        await api.post(`/crons/${agentId}`, {
          name: name.trim(), command: command.trim(),
          schedule: schedule.trim(), enabled,
        });
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response: { data: { detail?: string; error?: string } } }).response?.data?.detail ||
            (e as { response: { data: { error?: string } } }).response?.data?.error
          : "Request failed";
      setError(msg || "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-white text-lg font-bold mb-4">
          {editingCron ? "Edit Cron Job" : "New Cron Job"}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-sm">Agent *</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
              disabled={!!editingCron}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm mt-1 disabled:opacity-50">
              <option value="">Select agent...</option>
              {agents.filter((a) => a.status === "online" || a.id === editingCron?.agentId)
                .map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-sm">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm mt-1"
              placeholder="Nightly backup" />
          </div>
          <div>
            <label className="text-gray-400 text-sm">Command *</label>
            <input value={command} onChange={(e) => setCommand(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm mt-1 font-mono"
              placeholder="python /opt/backup.py" />
          </div>
          <div>
            <label className="text-gray-400 text-sm">Schedule (UTC) *</label>
            <input value={schedule} onChange={(e) => setSchedule(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm mt-1 font-mono"
              placeholder="* * * * *" />
            <p className="text-gray-600 text-xs mt-1">minute hour day-of-month month day-of-week</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-gray-600" />
            <span className="text-gray-300 text-sm">Enabled</span>
          </label>
        </div>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 px-4 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm font-medium py-2 px-4 rounded-lg">
            {submitting ? "Saving..." : editingCron ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
