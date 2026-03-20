import { execFile as execFileCallback } from "child_process";
import { promisify } from "util";

export const execFileAsync = promisify(execFileCallback);

export interface TailscalePeer {
  hostname: string;
  ip: string;
  online: boolean;
  tags: string[];
}

export interface TailscaleStatus {
  Self: {
    TailscaleIPs: string[];
    HostName: string;
    Online: boolean;
    Tags: string[];
  };
  Peer: Record<string, {
    TailscaleIPs: string[];
    HostName: string;
    Online: boolean;
    Tags: string[];
  }>;
}

export async function getTailscaleStatus(): Promise<TailscaleStatus> {
  const result = await execFileAsync("tailscale", ["status", "--json"]);
  // promisify returns the second callback parameter as the result (stdout for execFile)
  const stdout = typeof result === 'string' ? result : (result as any).stdout;
  return JSON.parse(stdout);
}

export async function discoverAgents(): Promise<TailscalePeer[]> {
  const status = await getTailscaleStatus();
  const peers: TailscalePeer[] = [];
  for (const [, peer] of Object.entries(status.Peer || {})) {
    const tags = peer.Tags || [];
    if (tags.includes("tag:multiclaw-agent")) {
      peers.push({
        hostname: peer.HostName || "",
        ip: peer.TailscaleIPs?.[0] || "",
        online: peer.Online ?? false,
        tags,
      });
    }
  }
  return peers;
}

export async function getTailscaleIp(): Promise<string> {
  const result = await execFileAsync("tailscale", ["ip", "-4"]);
  // promisify returns the second callback parameter as the result (stdout for execFile)
  const stdout = typeof result === 'string' ? result : (result as any).stdout;
  return stdout.trim();
}

export async function isTailscaleRunning(): Promise<boolean> {
  try {
    await execFileAsync("tailscale", ["status"]);
    return true;
  } catch {
    return false;
  }
}
