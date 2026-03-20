import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "operator", "viewer"] }).notNull().default("viewer"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const agentTemplates = sqliteTable("agent_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  provider: text("provider"),
  model: text("model"),
  systemPrompt: text("system_prompt"),
  skills: text("skills"), // JSON array of skill IDs
  plugins: text("plugins"), // JSON array of plugin IDs
  envVars: text("env_vars"), // JSON key-value pairs
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  apiKey: text("api_key").notNull(),
  status: text("status", { enum: ["online", "offline", "busy", "error"] }).notNull().default("offline"),
  lastSeen: text("last_seen"),
  metadata: text("metadata"),
  defaultProvider: text("default_provider").notNull().default("anthropic"),
  defaultModel: text("default_model").notNull().default("claude-sonnet-4-6"),
  registeredBy: text("registered_by").references(() => users.id),
  tailscaleIp: text("tailscale_ip"),
  tailscaleHostname: text("tailscale_hostname"),
  spawnedLocally: integer("spawned_locally", { mode: "boolean" }).notNull().default(false),
  spawnPid: integer("spawn_pid"),
  spawnPort: integer("spawn_port"),
  spawnDir: text("spawn_dir"),
  spawnHost: text("spawn_host"),
  identity: text("identity"),
  templateId: text("template_id").references(() => agentTemplates.id),
  containerId: text("container_id"),
  containerImage: text("container_image"),
  containerStatus: text("container_status"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const agentTasks = sqliteTable("agent_tasks", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id),
  prompt: text("prompt").notNull(),
  status: text("status", { enum: ["queued", "running", "completed", "failed", "cancelled"] }).notNull().default("queued"),
  result: text("result"),
  error: text("error"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at"),
});

export const skillProviders = sqliteTable("skill_providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  apiBaseUrl: text("api_base_url").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  version: text("version").notNull().default("0.1.0"),
  author: text("author"),
  source: text("source").notNull().default("custom"),
  sourceUrl: text("source_url"),
  sourceSlug: text("source_slug"),
  providerId: text("provider_id").references(() => skillProviders.id),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  uploadedBy: text("uploaded_by").references(() => users.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const agentSkills = sqliteTable("agent_skills", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id),
  skillId: text("skill_id").notNull().references(() => skills.id),
  installedAt: text("installed_at").notNull().$defaultFn(() => new Date().toISOString()),
  status: text("status", { enum: ["installed", "failed", "pending"] }).notNull().default("pending"),
});

export const plugins = sqliteTable("plugins", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  version: text("version").notNull().default("0.1.0"),
  author: text("author"),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  uploadedBy: text("uploaded_by").references(() => users.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const agentPlugins = sqliteTable("agent_plugins", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id),
  pluginId: text("plugin_id").notNull().references(() => plugins.id),
  installedAt: text("installed_at").notNull().$defaultFn(() => new Date().toISOString()),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  status: text("status", { enum: ["installed", "failed", "pending"] }).notNull().default("pending"),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(), // first 8 chars for display
  agentId: text("agent_id").references(() => agents.id),
  status: text("status", { enum: ["active", "revoked"] }).notNull().default("active"),
  lastUsedAt: text("last_used_at"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  revokedAt: text("revoked_at"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull().$defaultFn(() => new Date().toISOString()),
  actorType: text("actor_type").notNull(), // "user" | "agent" | "system"
  actorId: text("actor_id"), // Polymorphic — no FK constraint
  action: text("action").notNull(), // e.g., "agent.spawn", "task.create"
  targetType: text("target_type"), // e.g., "agent", "task", "skill"
  targetId: text("target_id"), // Polymorphic — no FK constraint
  metadata: text("metadata"), // JSON string with action-specific details
  ipAddress: text("ip_address"),
});

export const agentPermissions = sqliteTable("agent_permissions", {
  id: text("id").primaryKey(),
  fromAgentId: text("from_agent_id").notNull().references(() => agents.id),
  toAgentId: text("to_agent_id").notNull().references(() => agents.id),
  canDelegate: integer("can_delegate", { mode: "boolean" }).notNull().default(true),
  canQuery: integer("can_query", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const delegations = sqliteTable("delegations", {
  id: text("id").primaryKey(),
  fromAgentId: text("from_agent_id").notNull().references(() => agents.id),
  toAgentId: text("to_agent_id").notNull().references(() => agents.id),
  taskId: text("task_id").references(() => agentTasks.id),
  mode: text("mode", { enum: ["orchestrated", "direct"] }).notNull().default("orchestrated"),
  status: text("status", { enum: ["pending", "running", "completed", "failed"] }).notNull().default("pending"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at"),
});

export const pluginRegistry = sqliteTable("plugin_registry", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  version: text("version"),
  author: text("author"),
  repoUrl: text("repo_url"),
  type: text("type").notNull().default("git-plugin"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const sharedState = sqliteTable("shared_state", {
  id: text("id").primaryKey(),
  namespace: text("namespace").notNull(),
  key: text("key").notNull(),
  value: text("value"), // JSON string
  version: integer("version").notNull().default(1),
  createdBy: text("created_by"), // Polymorphic — agent or user ID, no FK
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at"),
});

export const knowledgeEntries = sqliteTable("knowledge_entries", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  embedding: text("embedding"), // JSON array of floats (fallback without sqlite-vec)
  metadata: text("metadata"), // JSON string
  createdBy: text("created_by"), // Polymorphic — no FK
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  definition: text("definition").notNull(), // JSON DAG structure
  status: text("status", { enum: ["draft", "active", "archived"] }).notNull().default("draft"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const workflowRuns = sqliteTable("workflow_runs", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull().references(() => workflows.id),
  status: text("status", { enum: ["running", "completed", "failed", "cancelled"] }).notNull().default("running"),
  input: text("input"), // JSON
  output: text("output"), // JSON
  startedAt: text("started_at").notNull().$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at"),
  createdBy: text("created_by").references(() => users.id),
});

export const workflowStepRuns = sqliteTable("workflow_step_runs", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => workflowRuns.id),
  stepId: text("step_id").notNull(), // matches key in definition
  agentId: text("agent_id").references(() => agents.id),
  taskId: text("task_id").references(() => agentTasks.id),
  status: text("status", { enum: ["pending", "running", "completed", "failed", "skipped"] }).notNull().default("pending"),
  input: text("input"), // JSON
  output: text("output"), // JSON
  startedAt: text("started_at"),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at"),
});

export const agentRegistryPlugins = sqliteTable("agent_registry_plugins", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id),
  registryPluginId: text("registry_plugin_id").notNull().references(() => pluginRegistry.id),
  status: text("status", { enum: ["pending", "installed", "failed", "uninstalling", "updating"] }).notNull().default("pending"),
  installedAt: text("installed_at"),
  updatedAt: text("updated_at"),
  error: text("error"),
});
