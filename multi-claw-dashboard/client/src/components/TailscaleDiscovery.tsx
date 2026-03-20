import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, silentApi } from "../api/client";

interface TailscalePeer {
  hostname: string;
  ip: string;
  online: boolean;
  registered: boolean;
}

export function TailscaleDiscovery() {
  const queryClient = useQueryClient();
  const [registering, setRegistering] = useState<string | null>(null);

  const { data: peers, isError } = useQuery({
    queryKey: ["tailscale-peers"],
    queryFn: () => silentApi().get<TailscalePeer[]>("/tailscale/peers").then((r) => r.data),
    retry: false,
    refetchInterval: 60000,
  });

  const registerMutation = useMutation({
    mutationFn: (ip: string) =>
      api.post("/tailscale/auto-register", { tailscaleIp: ip }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tailscale-peers"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setRegistering(null);
    },
    onError: () => setRegistering(null),
  });

  if (isError || !peers) return null;
  if (peers.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-purple-500" />
        Tailscale Network
      </h3>
      <div className="space-y-2">
        {peers.map((peer) => (
          <div
            key={peer.ip}
            className="flex items-center justify-between py-2 px-3 bg-gray-800 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${peer.online ? "bg-green-500" : "bg-gray-600"}`} />
              <div>
                <span className="text-sm font-medium">{peer.hostname}</span>
                <span className="text-xs text-gray-500 ml-2">{peer.ip}</span>
              </div>
            </div>
            {peer.registered ? (
              <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">
                Registered
              </span>
            ) : (
              <button
                onClick={() => {
                  setRegistering(peer.ip);
                  registerMutation.mutate(peer.ip);
                }}
                disabled={registering === peer.ip}
                className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded text-white transition"
              >
                {registering === peer.ip ? "..." : "Register"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
