import { useState, useEffect, useRef } from "react";
import { useSSE } from "../api/sse";

interface Step {
  agentId: string;
  agentName: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
}

interface OrchestrationEvent {
  id: string;
  stepIndex?: number;
  agentId?: string;
  agentName?: string;
  status?: string;
  result?: string;
  error?: string;
  prompt?: string;
  steps?: Step[];
  taskStatus?: string;
}

export function TaskStream() {
  const [orchestrations, setOrchestrations] = useState<
    Map<string, { prompt: string; steps: Step[]; status: string }>
  >(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSSE = (event: string, data: OrchestrationEvent) => {
    setOrchestrations((prev) => {
      const next = new Map(prev);

      if (event === "orchestration_start" && data.steps) {
        next.set(data.id, {
          prompt: data.prompt || "",
          steps: data.steps,
          status: "running",
        });
      }

      if (event === "orchestration_step") {
        const orch = next.get(data.id);
        if (orch && data.stepIndex !== undefined) {
          orch.steps[data.stepIndex] = {
            ...orch.steps[data.stepIndex],
            status: (data.status as Step["status"]) || "pending",
            result: data.result,
            error: data.error,
          };
        }
      }

      if (event === "orchestration_complete") {
        const orch = next.get(data.id);
        if (orch) orch.status = "completed";
      }

      if (event === "orchestration_error") {
        const orch = next.get(data.id);
        if (orch) orch.status = "failed";
      }

      return next;
    });
  };

  useSSE("/api/sse", handleSSE);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [orchestrations]);

  if (orchestrations.size === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-lg font-semibold mb-3">Live Tasks</h3>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {Array.from(orchestrations.entries())
          .reverse()
          .map(([id, orch]) => (
            <div key={id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-medium truncate flex-1">
                  {orch.prompt}
                </p>
                <span
                  className={`text-xs px-2 py-1 rounded-full ml-2 ${
                    orch.status === "completed"
                      ? "bg-green-900 text-green-300"
                      : orch.status === "failed"
                        ? "bg-red-900 text-red-300"
                        : "bg-blue-900 text-blue-300"
                  }`}
                >
                  {orch.status}
                </span>
              </div>
              <div className="space-y-2">
                {orch.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          step.status === "completed"
                            ? "bg-green-500"
                            : step.status === "running"
                              ? "bg-blue-500 animate-pulse"
                              : step.status === "failed"
                                ? "bg-red-500"
                                : "bg-gray-600"
                        }`}
                      />
                      <span className="text-gray-300 text-xs font-medium">
                        {step.agentName}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {step.status === "running" && (
                        <p className="text-blue-400 text-xs">Processing...</p>
                      )}
                      {step.result && (
                        <p className="text-gray-300 text-xs whitespace-pre-wrap line-clamp-3">
                          {step.result}
                        </p>
                      )}
                      {step.error && (
                        <p className="text-red-400 text-xs">{step.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
