import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { TailscaleStatus } from "./TailscaleStatus";

const nav = [
  { path: "/", label: "Dashboard" },
  { path: "/agents", label: "Agents" },
  { path: "/templates", label: "Templates" },
  { path: "/skills", label: "Skills" },
  { path: "/plugins", label: "Plugins" },
  { path: "/workflows", label: "Workflows" },
  { path: "/crons", label: "Crons" },
  { path: "/keys", label: "Keys" },
  { path: "/users", label: "Users" },
  { path: "/settings", label: "Settings" },
  { path: "/delegations", label: "Delegations" },
  { path: "/memory", label: "Memory" },
  { path: "/audit", label: "Audit Log" },
];

export function Layout({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold">MultiClaw</h1>
          <div className="flex gap-4">
            {nav.map((item) => (
              <Link key={item.path} to={item.path}
                className={`text-sm transition ${
                  (item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path))
                    ? "text-white font-medium" : "text-gray-400 hover:text-white"
                }`}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <TailscaleStatus />
          <Link to="/help" className={`text-sm transition ${location.pathname === "/help" ? "text-white font-medium" : "text-gray-400 hover:text-white"}`}>Help</Link>
          <button onClick={onLogout} className="text-sm text-gray-400 hover:text-white transition">Logout</button>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
