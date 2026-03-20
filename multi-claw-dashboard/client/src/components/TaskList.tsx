import type { Task } from "../lib/types";

const statusBadge = {
  queued: "bg-gray-700 text-gray-300", running: "bg-blue-900 text-blue-300",
  completed: "bg-green-900 text-green-300", failed: "bg-red-900 text-red-300",
  cancelled: "bg-gray-700 text-gray-400",
};

export function TaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return <p className="text-gray-500 text-sm">No tasks yet</p>;
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div key={task.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm truncate">{task.prompt}</p>
            <p className="text-gray-500 text-xs mt-1">{new Date(task.createdAt).toLocaleString()}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ml-3 ${statusBadge[task.status]}`}>{task.status}</span>
        </div>
      ))}
    </div>
  );
}
