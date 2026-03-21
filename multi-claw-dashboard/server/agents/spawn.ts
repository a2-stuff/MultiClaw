import { execSync, spawn as cpSpawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { db } from "../db/index.js";
import { agents } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { addCorsOrigin } from "../cors.js";

const AGENTS_BASE = path.join(os.homedir(), ".multiclaw", "agents");
const AGENT_SOURCE = path.resolve(process.cwd(), "../multi-claw-agent");

export function findAvailablePort(): number {
  const usedPorts = db.select({ port: agents.spawnPort }).from(agents).all()
    .map(r => r.port).filter((p): p is number => p !== null);
  let port = 8101;
  while (usedPorts.includes(port)) port++;
  return port;
}

export interface SpawnOptions {
  name: string;
  host?: string;
  dashboardUrl?: string;
}

export async function spawnLocalAgent(opts: SpawnOptions, userId: string): Promise<{
  agentId: string;
  port: number;
  dir: string;
  pid: number;
  apiKey: string;
}> {
  const port = findAvailablePort();
  const safeName = opts.name.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  const agentDir = path.join(AGENTS_BASE, safeName);

  if (existsSync(agentDir)) {
    throw new Error(`Agent directory already exists: ${agentDir}`);
  }

  // Create directory structure
  mkdirSync(agentDir, { recursive: true });
  mkdirSync(path.join(agentDir, "skills"), { recursive: true });
  mkdirSync(path.join(agentDir, "plugins"), { recursive: true });

  // Symlink src/ and pyproject.toml from source agent
  execSync(`ln -s ${path.join(AGENT_SOURCE, "src")} ${path.join(agentDir, "src")}`);
  execSync(`ln -s ${path.join(AGENT_SOURCE, "pyproject.toml")} ${path.join(agentDir, "pyproject.toml")}`);

  // Create isolated venv
  const venvDir = path.join(agentDir, ".venv");
  execSync(`python3 -m venv ${venvDir}`, { timeout: 60000 });
  execSync(`${path.join(venvDir, "bin", "pip")} install -e . --quiet`, {
    cwd: agentDir,
    timeout: 120000,
  });

  const agentId = uuid();
  const apiKey = `mca_${crypto.randomBytes(32).toString("hex")}`;
  const dashboardUrl = opts.dashboardUrl || `http://localhost:${config.port}`;

  // Write .env
  const envContent = [
    `MULTICLAW_AGENT_NAME=${opts.name}`,
    `MULTICLAW_AGENT_ID=${agentId}`,
    `MULTICLAW_AGENT_SECRET=${apiKey}`,
    `MULTICLAW_PORT=${port}`,
    `MULTICLAW_HOST=0.0.0.0`,
    `MULTICLAW_DASHBOARD_URL=${dashboardUrl}`,
    `MULTICLAW_AUTO_REGISTER=false`,
    `MULTICLAW_BASE_DIR=${agentDir}`,
    `MULTICLAW_SKILLS_DIR=${path.join(agentDir, "skills")}`,
    `MULTICLAW_PLUGINS_DIR=${path.join(agentDir, "plugins")}`,
  ].join("\n") + "\n";
  writeFileSync(path.join(agentDir, ".env"), envContent);
  writeFileSync(path.join(agentDir, "crons.json"), "[]");

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
    spawnDir: agentDir,
    spawnHost: null,
  }).run();

  // Auto-add CORS origin for the spawned agent
  const spawnOrigin = `http://${opts.host || "localhost"}:${port}`;
  addCorsOrigin(spawnOrigin);

  // Start process
  const pythonBin = path.join(venvDir, "bin", "python");
  const proc = cpSpawn(pythonBin, ["-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", String(port)], {
    cwd: agentDir,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, VIRTUAL_ENV: venvDir, PATH: `${path.join(venvDir, "bin")}:${process.env.PATH}` },
  });
  proc.unref();

  const pid = proc.pid!;
  db.update(agents).set({ spawnPid: pid }).where(eq(agents.id, agentId)).run();
  writeFileSync(path.join(agentDir, ".pid"), String(pid));

  return { agentId, port, dir: agentDir, pid, apiKey };
}

export function stopSpawnedAgent(agentId: string): void {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent) throw new Error("Agent not found");

  let killed = false;

  // Try stored PID first
  if (agent.spawnPid) {
    try {
      process.kill(agent.spawnPid, "SIGTERM");
      killed = true;
    } catch {
      // Process may already be dead
    }
  }

  // If no PID or stored PID was stale, find process by port
  if (!killed && agent.spawnPort) {
    try {
      const out = execSync(`lsof -ti tcp:${agent.spawnPort} 2>/dev/null || true`, { encoding: "utf-8" }).trim();
      if (out) {
        for (const pidStr of out.split("\n")) {
          const pid = parseInt(pidStr, 10);
          if (pid > 0) {
            try { process.kill(pid, "SIGTERM"); killed = true; } catch {}
          }
        }
      }
    } catch {
      // lsof may not be available
    }
  }

  if (!killed && !agent.spawnPid && !agent.spawnPort) {
    throw new Error("Agent has no PID or port to stop");
  }

  db.update(agents).set({ status: "offline", spawnPid: null }).where(eq(agents.id, agentId)).run();
}

export function startSpawnedAgent(agentId: string): number {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent || !agent.spawnDir) throw new Error("Agent not found or not spawned");

  // Check if port is already in use (agent may already be running externally)
  const port = agent.spawnPort || findAvailablePort();
  try {
    const out = execSync(`lsof -ti tcp:${port} 2>/dev/null || true`, { encoding: "utf-8" }).trim();
    if (out) throw new Error(`Port ${port} is already in use — agent may already be running`);
  } catch (e: any) {
    if (e.message?.includes("already in use")) throw e;
  }

  const venvDir = path.join(agent.spawnDir, ".venv");
  const pythonBin = path.join(venvDir, "bin", "python");

  const proc = cpSpawn(pythonBin, ["-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", String(port)], {
    cwd: agent.spawnDir,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, VIRTUAL_ENV: venvDir, PATH: `${path.join(venvDir, "bin")}:${process.env.PATH}` },
  });
  proc.unref();

  const pid = proc.pid!;
  db.update(agents).set({ spawnPid: pid, spawnPort: port }).where(eq(agents.id, agentId)).run();
  writeFileSync(path.join(agent.spawnDir, ".pid"), String(pid));

  // Auto-add CORS origin (port may have changed on restart)
  const restartOrigin = `http://${agent.spawnHost || "localhost"}:${port}`;
  addCorsOrigin(restartOrigin);

  return pid;
}
