import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ToastProvider } from "./hooks/useToast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Agents } from "./pages/Agents";
import { Skills } from "./pages/Skills";
import { Plugins } from "./pages/Plugins";
import { Crons } from "./pages/Crons";
import { Settings } from "./pages/Settings";
import { Users } from "./pages/Users";
import { Keys } from "./pages/Keys";
import { Help } from "./pages/Help";
import { Templates } from "./pages/Templates";
import { AuditLog } from "./pages/AuditLog";
import { Delegations } from "./pages/Delegations";
import { Memory } from "./pages/Memory";
import { Workflows } from "./pages/Workflows";
import { Layout } from "./components/Layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

function AppRoutes() {
  const { user, loading, logout } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-950" />;
  if (!user) return <Login />;
  return (
    <Layout onLogout={logout}>
      <Routes>
        <Route path="/" element={<ErrorBoundary inline><Dashboard /></ErrorBoundary>} />
        <Route path="/agents" element={<ErrorBoundary inline><Agents /></ErrorBoundary>} />
        <Route path="/agents/:id" element={<Navigate to="/agents" />} />
        <Route path="/skills" element={<ErrorBoundary inline><Skills /></ErrorBoundary>} />
        <Route path="/plugins" element={<ErrorBoundary inline><Plugins /></ErrorBoundary>} />
        <Route path="/crons" element={<ErrorBoundary inline><Crons /></ErrorBoundary>} />
        <Route path="/settings" element={<ErrorBoundary inline><Settings /></ErrorBoundary>} />
        <Route path="/keys" element={<ErrorBoundary inline><Keys /></ErrorBoundary>} />
        <Route path="/users" element={<ErrorBoundary inline><Users /></ErrorBoundary>} />
        <Route path="/templates" element={<ErrorBoundary inline><Templates /></ErrorBoundary>} />
        <Route path="/workflows" element={<ErrorBoundary inline><Workflows /></ErrorBoundary>} />
        <Route path="/audit" element={<ErrorBoundary inline><AuditLog /></ErrorBoundary>} />
        <Route path="/delegations" element={<ErrorBoundary inline><Delegations /></ErrorBoundary>} />
        <Route path="/memory" element={<ErrorBoundary inline><Memory /></ErrorBoundary>} />
        <Route path="/help" element={<ErrorBoundary inline><Help /></ErrorBoundary>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
