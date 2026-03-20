import { config } from "../config.js";

interface AgentLike {
  url: string;
  tailscaleIp?: string | null;
}

export function resolveAgentUrl(agent: AgentLike): string {
  if (config.tailscaleEnabled && agent.tailscaleIp) {
    try {
      const parsed = new URL(agent.url);
      return `http://${agent.tailscaleIp}:${parsed.port || "8100"}`;
    } catch {
      return agent.url;
    }
  }
  return agent.url;
}
