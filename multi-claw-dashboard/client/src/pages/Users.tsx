import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";

interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: "admin" | "operator" | "viewer";
  createdAt: string;
}

const roleBadge = {
  admin: "bg-purple-900 text-purple-300",
  operator: "bg-blue-900 text-blue-300",
  viewer: "bg-gray-700 text-gray-300",
};

export function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchUsers = () => {
    api
      .get("/users")
      .then((res) => setUsers(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(fetchUsers, []);

  const changeRole = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole as UserInfo["role"] } : u))
      );
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update role");
      setTimeout(() => setError(""), 3000);
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete user");
      setTimeout(() => setError(""), 3000);
    }
  };

  if (loading) return <p className="text-gray-400">Loading users...</p>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">User Management</h2>
        <span className="text-sm text-gray-400">{users.length} users</span>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-800 rounded-lg px-4 py-2 mb-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-sm text-gray-400 font-medium">User</th>
              <th className="text-left px-5 py-3 text-sm text-gray-400 font-medium">Role</th>
              <th className="text-left px-5 py-3 text-sm text-gray-400 font-medium">Joined</th>
              <th className="text-right px-5 py-3 text-sm text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isCurrentUser = user.id === currentUser?.id;
              return (
                <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-white text-sm font-medium">
                        {user.name}
                        {isCurrentUser && (
                          <span className="text-gray-500 text-xs ml-2">(you)</span>
                        )}
                      </p>
                      <p className="text-gray-500 text-xs">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {isCurrentUser ? (
                      <span className={`text-xs px-2.5 py-1 rounded-full ${roleBadge[user.role]}`}>
                        {user.role}
                      </span>
                    ) : (
                      <select
                        value={user.role}
                        onChange={(e) => changeRole(user.id, e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="admin">admin</option>
                        <option value="operator">operator</option>
                        <option value="viewer">viewer</option>
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-gray-400 text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {!isCurrentUser && (
                      <button
                        onClick={() => deleteUser(user.id, user.name)}
                        className="text-red-400 hover:text-red-300 text-xs transition"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
