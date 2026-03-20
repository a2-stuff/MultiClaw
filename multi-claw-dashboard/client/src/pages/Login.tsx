import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export function Login() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegister) { await register(email, password, name); }
      else { await login(email, password); }
    } catch (err: any) {
      setError(err.response?.data?.error || "Authentication failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-2">MultiClaw</h1>
        <p className="text-gray-400 mb-6">{isRegister ? "Create your account" : "Sign in to your dashboard"}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          )}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
            {isRegister ? "Register" : "Sign In"}
          </button>
        </form>
        <button onClick={() => setIsRegister(!isRegister)} className="mt-4 text-sm text-gray-400 hover:text-white transition">
          {isRegister ? "Already have an account? Sign in" : "Need an account? Register"}
        </button>
      </div>
    </div>
  );
}
