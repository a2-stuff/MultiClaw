import { useState } from "react";

interface SystemData {
  hostname: string;
  os: string;
  platform?: string;
  arch: string;
  python?: string;
  uptime_seconds?: number;
  load_avg?: { "1m": number; "5m": number; "15m": number };
  cpu: { percent: number; count: number; count_physical?: number; freq_mhz: number | null };
  memory: { total_gb: number; used_gb: number; available_gb?: number; percent: number };
  swap?: { total_gb: number; used_gb: number; percent: number };
  disk: { total_gb: number; used_gb: number; free_gb?: number; percent: number };
  network?: { bytes_sent_mb: number; bytes_recv_mb: number; packets_sent: number; packets_recv: number };
  connections?: { established: number; listen: number; time_wait: number; close_wait: number; total: number };
  processes: number;
  top_processes?: { pid: number; name: string; cpu: number; mem: number }[];
  open_ports: { port: number; address: string; pid: number | null }[];
}

interface TaskStats {
  active: number;
  completed: number;
  failed: number;
  queued: number;
}

interface ParsedMetadata {
  system?: SystemData;
  tasks?: TaskStats;
  uptime?: number;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatBytes(mb: number): string {
  if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function ProgressBar({ percent, label, detail }: { percent: number; label: string; detail?: string }) {
  const color =
    percent > 85 ? "bg-red-500" : percent > 60 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span>{detail || `${percent.toFixed(1)}%`}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col gap-2">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h4>
      {children}
    </div>
  );
}

function PortsList({ ports }: { ports: SystemData["open_ports"] }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 8;
  const shown = expanded ? ports : ports.slice(0, LIMIT);

  if (ports.length === 0) return <span className="text-gray-500 text-xs italic">None</span>;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((p, i) => (
          <span key={i} className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded border border-gray-600"
            title={`${p.address}:${p.port}${p.pid ? ` (PID ${p.pid})` : ""}`}>
            {p.port}
          </span>
        ))}
      </div>
      {ports.length > LIMIT && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-1.5 text-xs text-blue-400 hover:text-blue-300 transition">
          {expanded ? "Show less" : `+${ports.length - LIMIT} more`}
        </button>
      )}
    </div>
  );
}

export function SystemInfo({ metadata }: { metadata: string | null }) {
  if (!metadata) return null;

  let parsed: ParsedMetadata;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    return null;
  }

  const { system, tasks } = parsed;
  if (!system && !tasks) return null;

  return (
    <div className="space-y-4">
      {system && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-4">Host Overview</h3>

          {/* Host Info Bar */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 mb-5 text-sm">
            <div><span className="text-gray-500">Hostname </span><span className="text-white font-medium">{system.hostname}</span></div>
            <div><span className="text-gray-500">OS </span><span className="text-white font-medium">{system.os}</span></div>
            <div><span className="text-gray-500">Arch </span><span className="text-white font-medium">{system.arch}</span></div>
            {system.python && <div><span className="text-gray-500">Python </span><span className="text-white font-medium">{system.python}</span></div>}
            {system.uptime_seconds != null && (
              <div><span className="text-gray-500">Uptime </span><span className="text-green-400 font-medium">{formatUptime(system.uptime_seconds)}</span></div>
            )}
            {system.load_avg && (
              <div><span className="text-gray-500">Load </span><span className="text-white font-medium">{system.load_avg["1m"]} / {system.load_avg["5m"]} / {system.load_avg["15m"]}</span></div>
            )}
          </div>

          {/* Resource Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {/* CPU */}
            <StatCard title="CPU">
              <ProgressBar percent={system.cpu.percent} label="Usage" />
              <div className="text-xs text-gray-400 space-y-0.5">
                <div>{system.cpu.count_physical || system.cpu.count} cores ({system.cpu.count} threads)</div>
                {system.cpu.freq_mhz != null && <div>{(system.cpu.freq_mhz / 1000).toFixed(2)} GHz</div>}
              </div>
            </StatCard>

            {/* Memory */}
            <StatCard title="Memory">
              <ProgressBar percent={system.memory.percent} label="Usage"
                detail={`${system.memory.used_gb.toFixed(1)} / ${system.memory.total_gb.toFixed(1)} GB`} />
              {system.memory.available_gb != null && (
                <div className="text-xs text-gray-400">{system.memory.available_gb.toFixed(1)} GB available</div>
              )}
              {system.swap && system.swap.total_gb > 0 && (
                <div className="text-xs text-gray-500">Swap: {system.swap.used_gb.toFixed(1)} / {system.swap.total_gb.toFixed(1)} GB ({system.swap.percent}%)</div>
              )}
            </StatCard>

            {/* Disk */}
            <StatCard title="Disk">
              <ProgressBar percent={system.disk.percent} label="Usage"
                detail={`${system.disk.used_gb.toFixed(0)} / ${system.disk.total_gb.toFixed(0)} GB`} />
              {system.disk.free_gb != null && (
                <div className="text-xs text-gray-400">{system.disk.free_gb.toFixed(1)} GB free</div>
              )}
            </StatCard>

            {/* Network I/O */}
            <StatCard title="Network">
              {system.network ? (
                <div className="text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between"><span>Sent</span><span className="text-white">{formatBytes(system.network.bytes_sent_mb)}</span></div>
                  <div className="flex justify-between"><span>Received</span><span className="text-white">{formatBytes(system.network.bytes_recv_mb)}</span></div>
                  <div className="flex justify-between"><span>Packets Out</span><span className="text-gray-300">{system.network.packets_sent.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Packets In</span><span className="text-gray-300">{system.network.packets_recv.toLocaleString()}</span></div>
                </div>
              ) : (
                <span className="text-gray-500 text-xs">No data</span>
              )}
            </StatCard>
          </div>

          {/* Connections + Processes + Ports Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Connections */}
            <StatCard title="Connections">
              {system.connections ? (
                <div className="text-xs space-y-1">
                  <div className="flex justify-between text-gray-400"><span>Established</span><span className="text-green-400 font-medium">{system.connections.established}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Listening</span><span className="text-blue-400 font-medium">{system.connections.listen}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Time Wait</span><span className="text-yellow-400 font-medium">{system.connections.time_wait}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Close Wait</span><span className="text-red-400 font-medium">{system.connections.close_wait}</span></div>
                  <div className="flex justify-between text-gray-400 border-t border-gray-700 pt-1 mt-1"><span>Total</span><span className="text-white font-medium">{system.connections.total}</span></div>
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white">{system.processes}</span>
                  <span className="text-xs text-gray-500">processes</span>
                </div>
              )}
            </StatCard>

            {/* Top Processes */}
            <StatCard title={`Processes (${system.processes})`}>
              {system.top_processes && system.top_processes.length > 0 ? (
                <div className="text-xs space-y-1">
                  <div className="flex justify-between text-gray-500 mb-0.5">
                    <span>Name</span><span>CPU / Mem</span>
                  </div>
                  {system.top_processes.map((p, i) => (
                    <div key={i} className="flex justify-between text-gray-300">
                      <span className="truncate max-w-[120px]" title={p.name}>{p.name}</span>
                      <span className="text-gray-400">{p.cpu}% / {p.mem}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white">{system.processes}</span>
                  <span className="text-xs text-gray-500">running</span>
                </div>
              )}
            </StatCard>

            {/* Open Ports */}
            <StatCard title={`Open Ports (${system.open_ports.length})`}>
              <PortsList ports={system.open_ports} />
            </StatCard>
          </div>
        </div>
      )}

      {tasks && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-4">Task Status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {tasks.active > 0 && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                <span className="text-xs text-gray-400 uppercase tracking-wide">Active</span>
              </div>
              <span className="text-2xl font-bold text-white">{tasks.active}</span>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Completed</div>
              <span className="text-2xl font-bold text-green-400">{tasks.completed}</span>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Failed</div>
              <span className="text-2xl font-bold text-red-400">{tasks.failed}</span>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Queued</div>
              <span className="text-2xl font-bold text-yellow-400">{tasks.queued}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
