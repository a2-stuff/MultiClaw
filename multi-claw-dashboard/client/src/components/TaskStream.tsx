import { useState, useEffect, useRef } from "react";
import { useSSE } from "../api/sse";

interface Step {
  agentId: string;
  agentName: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
}

interface OrchestrationState {
  prompt: string;
  steps: Step[];
  status: string;
  mode?: "parallel" | "direct" | "dashboard" | string;
  dashboardAnswer?: string;
  dashboardAnswerPending?: boolean;
  synthesis?: string;
  synthesisError?: string;
  synthesisPending?: boolean;
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
  mode?: string;
  answer?: string;
  synthesis?: string;
}

export function TaskStream() {
  const [orchestrations, setOrchestrations] = useState<
    Map<string, OrchestrationState>
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
          mode: data.mode,
        });
      }

      if (event === "orchestration_step") {
        const orch = next.get(data.id);
        if (orch && data.stepIndex !== undefined) {
          const updatedSteps = [...orch.steps];
          updatedSteps[data.stepIndex] = {
            ...updatedSteps[data.stepIndex],
            status: (data.status as Step["status"]) || "pending",
            result: data.result,
            error: data.error,
          };
          next.set(data.id, { ...orch, steps: updatedSteps });
        }
      }

      if (event === "orchestration_complete") {
        const orch = next.get(data.id);
        if (orch) {
          next.set(data.id, {
            ...orch,
            status: "completed",
            synthesis: data.synthesis ?? orch.synthesis,
          });
        }
      }

      if (event === "orchestration_error") {
        const orch = next.get(data.id);
        if (orch) next.set(data.id, { ...orch, status: "failed" });
      }

      if (event === "dashboard_answer_start") {
        // Create the entry — no orchestration_start is fired for dashboard queries
        next.set(data.id, {
          prompt: data.prompt || "",
          steps: [],
          status: "running",
          mode: "dashboard",
          dashboardAnswerPending: true,
        });
      }

      if (event === "dashboard_answer") {
        const orch = next.get(data.id);
        const base = orch || { prompt: "", steps: [], mode: "dashboard" };
        next.set(data.id, {
          ...base,
          status: data.status === "failed" ? "failed" : "completed",
          dashboardAnswer: data.answer,
          dashboardAnswerPending: false,
        });
      }

      if (event === "synthesis_start") {
        const orch = next.get(data.id);
        if (orch) {
          next.set(data.id, { ...orch, synthesisPending: true });
        }
      }

      if (event === "synthesis_complete") {
        const orch = next.get(data.id);
        if (orch) {
          next.set(data.id, {
            ...orch,
            synthesis: data.synthesis,
            synthesisPending: false,
          });
        }
      }

      if (event === "synthesis_error") {
        const orch = next.get(data.id);
        if (orch) {
          next.set(data.id, {
            ...orch,
            synthesisError: data.error,
            synthesisPending: false,
          });
        }
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
          .map(([id, orch]) => {
            const completedSteps = orch.steps.filter(
              (s) => s.status === "completed" || s.status === "failed"
            ).length;
            const totalSteps = orch.steps.length;
            const isParallel = orch.mode === "parallel";

            return (
              <div key={id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white text-sm font-medium truncate flex-1">
                    {orch.prompt}
                  </p>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    {isParallel && orch.status === "running" && totalSteps > 0 && (
                      <span className="text-gray-400 text-xs">
                        {completedSteps}/{totalSteps} agents complete
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
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
                </div>

                {/* Agent steps */}
                {orch.steps.length > 0 && (
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
                )}

                {/* Dashboard direct answer */}
                {orch.dashboardAnswerPending && (
                  <p className="text-blue-400 text-xs mt-3 animate-pulse">
                    Dashboard is thinking...
                  </p>
                )}
                {orch.dashboardAnswer && (
                  <div className="bg-gray-900/50 border-l-4 border-blue-500 rounded-lg p-4 mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-blue-400 text-sm font-semibold">
                        Dashboard
                      </span>
                    </div>
                    <div className="text-gray-300 text-sm whitespace-pre-wrap">
                      {orch.dashboardAnswer}
                    </div>
                  </div>
                )}

                {/* Synthesis pending indicator */}
                {orch.synthesisPending && (
                  <p className="text-purple-400 text-xs mt-3 animate-pulse">
                    Synthesizing results...
                  </p>
                )}

                {/* Synthesis result */}
                {orch.synthesis && (
                  <div className="bg-gray-900/50 border-l-4 border-purple-500 rounded-lg p-4 mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-purple-400 text-sm font-semibold">
                        ★ Dashboard Summary
                      </span>
                    </div>
                    <div className="text-gray-300 text-sm whitespace-pre-wrap">
                      {orch.synthesis}
                    </div>
                  </div>
                )}

                {/* Synthesis error */}
                {orch.synthesisError && (
                  <p className="text-red-400 text-xs mt-3">
                    Synthesis failed: {orch.synthesisError}
                  </p>
                )}
              </div>
            );
          })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
