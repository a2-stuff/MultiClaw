export interface AgentPermission {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  canDelegate: boolean;
  canQuery: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Delegation {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  taskId: string | null;
  mode: "orchestrated" | "direct";
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
