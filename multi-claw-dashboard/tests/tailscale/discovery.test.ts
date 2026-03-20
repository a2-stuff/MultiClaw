import { describe, it, expect, vi, beforeEach } from "vitest";

const MOCK_STATUS = {
  Self: {
    TailscaleIPs: ["100.64.0.1"],
    HostName: "dashboard-host",
    Online: true,
    Tags: ["tag:multiclaw-dashboard"],
  },
  Peer: {
    "nodekey:abc": {
      TailscaleIPs: ["100.64.0.2"],
      HostName: "agent-1",
      Online: true,
      Tags: ["tag:multiclaw-agent"],
    },
    "nodekey:def": {
      TailscaleIPs: ["100.64.0.3"],
      HostName: "agent-2",
      Online: false,
      Tags: ["tag:multiclaw-agent"],
    },
  },
};

vi.mock("child_process", () => ({
  execFile: vi.fn((cmd: string, args: string[], callback: (err: any, stdout: any, stderr: any) => void) => {
    // Use setImmediate to simulate async behavior
    setImmediate(() => {
      if (cmd === "tailscale" && args[0] === "status" && args.includes("--json")) {
        callback(null, JSON.stringify(MOCK_STATUS), "");
      } else if (cmd === "tailscale" && args[0] === "ip") {
        callback(null, "100.64.0.1\n", "");
      } else if (cmd === "tailscale" && args[0] === "status") {
        callback(null, "ok", "");
      }
    });
  }),
}));

describe("tailscale discovery", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getTailscaleStatus returns parsed status", async () => {
    const { getTailscaleStatus } = await import("../../server/tailscale/discovery.js");
    const status = await getTailscaleStatus();
    expect(status.Self.HostName).toBe("dashboard-host");
  });

  it("discoverAgents filters by agent tag", async () => {
    const { discoverAgents } = await import("../../server/tailscale/discovery.js");
    const agents = await discoverAgents();
    expect(agents).toHaveLength(2);
    expect(agents[0].hostname).toBe("agent-1");
    expect(agents[0].ip).toBe("100.64.0.2");
  });

  it("getTailscaleIp returns local IP", async () => {
    const { getTailscaleIp } = await import("../../server/tailscale/discovery.js");
    const ip = await getTailscaleIp();
    expect(ip).toBe("100.64.0.1");
  });

  it("isTailscaleRunning returns true on success", async () => {
    const { isTailscaleRunning } = await import("../../server/tailscale/discovery.js");
    const running = await isTailscaleRunning();
    expect(running).toBe(true);
  });
});
