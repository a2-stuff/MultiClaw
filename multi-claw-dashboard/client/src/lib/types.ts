export interface Agent {
  id: string;
  name: string;
  url: string;
  status: "online" | "offline" | "busy" | "error";
  lastSeen: string | null;
  createdAt: string;
  defaultProvider: string;
  defaultModel: string;
  spawnedLocally?: boolean;
  spawnPid?: number | null;
  spawnPort?: number | null;
  spawnDir?: string | null;
  spawnHost?: string | null;
  identity?: string | null;
  containerId?: string | null;
  containerImage?: string | null;
  containerStatus?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "operator" | "viewer";
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  version: string;
  author: string | null;
  source: string;
  sourceUrl: string | null;
  sourceSlug: string | null;
  providerId: string | null;
  fileSize: number | null;
  createdAt: string;
}

export interface SkillProvider {
  id: string;
  name: string;
  type: string;
  apiBaseUrl: string;
  enabled: boolean;
}

export interface SkillSearchResult {
  slug: string;
  name: string;
  description: string;
  version: string | null;
  author: string | null;
  stats?: { stars?: number; downloads?: number; installs?: number };
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: string;
}

export interface CronJob {
  id: string;
  name: string;
  command: string;
  schedule: string;
  enabled: boolean;
  created_at: string;
  updated_at: string | null;
  last_run_at: string | null;
  last_exit_code: number | null;
  last_output: string | null;
  next_run_at: string | null;
  agentId: string;
  agentName: string;
}

export interface CronRun {
  started_at: string;
  completed_at: string;
  exit_code: number;
  output: string;
  duration_ms: number;
}

export interface Task {
  id: string;
  agentId: string;
  prompt: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  result?: string;
  error?: string;
  createdBy?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AgentDetail extends Agent {
  registeredBy: string | null;
  metadata: string | null;
  tailscaleIp: string | null;
  tailscaleHostname: string | null;
}

export interface AgentSkill {
  id: string;
  skillId: string;
  skillName: string;
  skillVersion: string;
  status: "installed" | "failed" | "pending";
  installedAt: string;
}

export interface AgentPlugin {
  id: string;
  pluginId: string;
  pluginName: string;
  pluginVersion: string;
  enabled: boolean;
  status: "installed" | "failed" | "pending";
  installedAt: string;
}

export interface AgentStats {
  skillCount: number;
  pluginCount: number;
  taskCount: number;
  recentTaskCount: number;
}

export interface AgentPluginStatus {
  agentId: string;
  status: "pending" | "installed" | "failed" | "uninstalling" | "updating";
  installedAt: string | null;
  updatedAt: string | null;
  error: string | null;
}

export interface RegistryPlugin {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  author: string;
  repoUrl: string;
  type: string;
  createdAt: string;
  agents: AgentPluginStatus[];
}

export interface DeployResult {
  agentId: string;
  success: boolean;
  error?: string;
  skills_count?: number;
}
