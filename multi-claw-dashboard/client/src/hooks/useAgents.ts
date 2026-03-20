import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import { useWebSocket } from "../api/ws";
import type { Agent } from "../lib/types";

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/agents").then((res) => setAgents(res.data)).finally(() => setLoading(false));
  }, []);
  const handleSSE = useCallback((_event: string, data: any) => {
    if (Array.isArray(data)) {
      // Merge partial updates (id, name, status, lastSeen) into existing full agent data
      setAgents((prev) => {
        if (prev.length === 0) return data;
        return prev.map((agent) => {
          const update = data.find((u: any) => u.id === agent.id);
          return update ? { ...agent, ...update } : agent;
        });
      });
    }
  }, []);
  useWebSocket(handleSSE);
  return { agents, loading };
}
