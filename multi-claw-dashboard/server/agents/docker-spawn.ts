import Docker from "dockerode";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { db } from "../db/index.js";
import { agents } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { addCorsOrigin } from "../cors.js";
import { auditLog } from "../audit/logger.js";

const docker = new Docker();
const NETWORK_NAME = "multiclaw-net";
const AGENT_IMAGE = "multiclaw-agent:latest";

export async function isDockerAvailable(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

async function ensureNetwork(): Promise<void> {
  try {
    await docker.getNetwork(NETWORK_NAME).inspect();
  } catch {
    await docker.createNetwork({ Name: NETWORK_NAME, Driver: "bridge" });
  }
}

async function ensureAgentImage(): Promise<boolean> {
  try {
    await docker.getImage(AGENT_IMAGE).inspect();
    return true;
  } catch {
    // Image needs to be built — for now, return false
    // Building requires the Dockerfile.agent and multi-claw-agent source
    console.warn("multiclaw-agent:latest image not found. Build it with: docker build -f Dockerfile.agent -t multiclaw-agent:latest .");
    return false;
  }
}

export async function spawnDockerAgent(opts: {
  name: string;
  port?: number;
  memoryLimit?: string;
  cpuLimit?: string;
  dashboardUrl?: string;
}, userId: string): Promise<{
  agentId: string;
  containerId: string;
  port: number;
}> {
  if (!await isDockerAvailable()) throw new Error("Docker is not available");
  if (!await ensureAgentImage()) throw new Error("multiclaw-agent:latest image not found. Build it first.");

  await ensureNetwork();

  const agentId = uuid();
  const apiKey = `mca_${crypto.randomBytes(32).toString("hex")}`;
  const port = opts.port || await findAvailableDockerPort();
  const safeName = opts.name.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  const containerName = `multiclaw-agent-${safeName}`;
  const dashboardUrl = opts.dashboardUrl || `http://host.docker.internal:${config.port}`;

  const container = await docker.createContainer({
    Image: AGENT_IMAGE,
    name: containerName,
    Env: [
      `MULTICLAW_AGENT_NAME=${opts.name}`,
      `MULTICLAW_AGENT_ID=${agentId}`,
      `MULTICLAW_AGENT_SECRET=${apiKey}`,
      `MULTICLAW_PORT=8100`,
      `MULTICLAW_HOST=0.0.0.0`,
      `MULTICLAW_DASHBOARD_URL=${dashboardUrl}`,
      `MULTICLAW_AUTO_REGISTER=false`,
    ],
    ExposedPorts: { "8100/tcp": {} },
    HostConfig: {
      PortBindings: { "8100/tcp": [{ HostPort: String(port) }] },
      Memory: parseMemory(opts.memoryLimit || "512m"),
      NanoCpus: Math.floor(parseFloat(opts.cpuLimit || "1.0") * 1e9),
      NetworkMode: NETWORK_NAME,
      RestartPolicy: { Name: "unless-stopped" },
    },
  });

  await container.start();
  const containerId = container.id;

  // Register in DB
  db.insert(agents).values({
    id: agentId,
    name: opts.name,
    url: `http://localhost:${port}`,
    apiKey,
    status: "offline",
    registeredBy: userId,
    spawnedLocally: true,
    spawnPort: port,
    containerId,
    containerImage: AGENT_IMAGE,
    containerStatus: "running",
  }).run();

  addCorsOrigin(`http://localhost:${port}`);

  auditLog({
    actorType: "user", actorId: userId,
    action: "agent.docker_spawn", targetType: "agent", targetId: agentId,
    metadata: { containerId, port, image: AGENT_IMAGE },
  });

  return { agentId, containerId, port };
}

export async function stopDockerAgent(agentId: string): Promise<void> {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent?.containerId) throw new Error("Agent has no container");

  const container = docker.getContainer(agent.containerId);
  await container.stop();
  db.update(agents).set({ status: "offline", containerStatus: "stopped" }).where(eq(agents.id, agentId)).run();
}

export async function startDockerAgent(agentId: string): Promise<void> {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent?.containerId) throw new Error("Agent has no container");

  const container = docker.getContainer(agent.containerId);
  await container.start();
  db.update(agents).set({ containerStatus: "running" }).where(eq(agents.id, agentId)).run();
}

export async function deleteDockerAgent(agentId: string): Promise<void> {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent?.containerId) throw new Error("Agent has no container");

  const container = docker.getContainer(agent.containerId);
  try { await container.stop(); } catch { /* might already be stopped */ }
  await container.remove({ force: true });
  db.delete(agents).where(eq(agents.id, agentId)).run();
}

export async function getContainerLogs(agentId: string, tail: number = 100): Promise<string> {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent?.containerId) throw new Error("Agent has no container");

  const container = docker.getContainer(agent.containerId);
  const logs = await container.logs({ stdout: true, stderr: true, tail });
  return logs.toString("utf-8");
}

async function findAvailableDockerPort(): Promise<number> {
  const usedPorts = db.select({ port: agents.spawnPort }).from(agents).all()
    .map(r => r.port).filter((p): p is number => p !== null);
  let port = 8101;
  while (usedPorts.includes(port)) port++;
  return port;
}

function parseMemory(limit: string): number {
  const match = limit.match(/^(\d+)([mg])$/i);
  if (!match) return 512 * 1024 * 1024;
  const [, num, unit] = match;
  return parseInt(num) * (unit.toLowerCase() === "g" ? 1024 * 1024 * 1024 : 1024 * 1024);
}
