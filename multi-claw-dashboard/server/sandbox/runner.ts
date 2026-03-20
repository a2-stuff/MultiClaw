import { getDocker, isDockerAvailable, ensureBaseImage } from "./image-cache.js";
import { auditLog } from "../audit/logger.js";

interface SandboxConfig {
  network?: boolean;
  memoryLimit?: string;
  cpuLimit?: string;
  timeout?: number;
  allowedHosts?: string[];
}

interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

const DEFAULT_CONFIG: SandboxConfig = {
  network: false,
  memoryLimit: "256m",
  cpuLimit: "0.5",
  timeout: 60,
};

export async function runInSandbox(
  pluginCode: string,
  input: string,
  config: SandboxConfig = {},
  agentId?: string,
): Promise<SandboxResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!await isDockerAvailable()) {
    throw new Error("Docker is not available — plugin sandboxing disabled");
  }
  await ensureBaseImage();

  const docker = getDocker();
  const containerConfig: any = {
    Image: "multiclaw-sandbox:latest",
    Cmd: ["python3", "-c", pluginCode],
    Env: [`PLUGIN_INPUT=${Buffer.from(input).toString("base64")}`],
    HostConfig: {
      Memory: parseMemory(cfg.memoryLimit!),
      NanoCpus: Math.floor(parseFloat(cfg.cpuLimit!) * 1e9),
      NetworkMode: cfg.network ? "bridge" : "none",
      ReadonlyRootfs: true,
      PidsLimit: 50,
      Tmpfs: { "/tmp": "rw,noexec,nosuid,size=64m" },
    },
    NetworkDisabled: !cfg.network,
    StopTimeout: cfg.timeout,
  };

  const container = await docker.createContainer(containerConfig);

  try {
    await container.start();

    // Wait for completion with timeout
    const timeoutMs = (cfg.timeout || 60) * 1000;
    const waitPromise = container.wait();
    const timeoutPromise = new Promise<{ timedOut: true }>((resolve) =>
      setTimeout(() => resolve({ timedOut: true }), timeoutMs)
    );

    const result = await Promise.race([waitPromise, timeoutPromise]);
    let timedOut = false;

    if ("timedOut" in result) {
      timedOut = true;
      try { await container.kill(); } catch { /* already dead */ }
    }

    // Capture logs
    const logs = await container.logs({ stdout: true, stderr: true });
    const output = logs.toString("utf-8");
    // Docker multiplexed stream: split stdout/stderr
    const stdout = output; // Simplified — full demux would parse stream headers
    const stderr = "";

    const exitCode = timedOut ? 137 : (result as any).StatusCode || 0;

    auditLog({
      actorType: "system", actorId: agentId || null,
      action: "sandbox.run", targetType: "plugin",
      metadata: { exitCode, timedOut, memoryLimit: cfg.memoryLimit },
    });

    return { stdout, stderr, exitCode, timedOut };
  } finally {
    try { await container.remove({ force: true }); } catch { /* ignore */ }
  }
}

function parseMemory(limit: string): number {
  const match = limit.match(/^(\d+)([mg])$/i);
  if (!match) return 256 * 1024 * 1024;
  const [, num, unit] = match;
  return parseInt(num) * (unit.toLowerCase() === "g" ? 1024 * 1024 * 1024 : 1024 * 1024);
}
