import { useQuery } from "@tanstack/react-query";
import { silentApi } from "../api/client";

export function TailscaleStatus() {
  const { data, isError } = useQuery({
    queryKey: ["tailscale-status"],
    queryFn: () => silentApi().get("/tailscale/status").then((r) => r.data),
    retry: false,
    refetchInterval: 30000,
  });

  if (isError || !data) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      <span className={`w-2 h-2 rounded-full ${data.connected ? "bg-green-500" : "bg-red-500"}`} />
      <span>{data.connected ? "Tailscale" : "TS Offline"}</span>
    </div>
  );
}
