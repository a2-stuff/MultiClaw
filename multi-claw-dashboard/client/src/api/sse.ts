import { useEffect, useRef } from "react";

export function useSSE(url: string, onEvent: (event: string, data: any) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let closed = false;
    let timer: ReturnType<typeof setTimeout>;

    function connect() {
      if (closed) return;
      const token = localStorage.getItem("token");
      const fullUrl = `${url}${url.includes("?") ? "&" : "?"}token=${token}`;
      const es = new EventSource(fullUrl);

      const handleEvent = (evt: string) => (e: MessageEvent) => {
        try {
          onEventRef.current(evt, JSON.parse(e.data));
        } catch (err) {
          console.warn(`SSE: failed to parse ${evt} event`, err);
        }
      };

      es.addEventListener("agents_update", handleEvent("agents_update"));
      es.addEventListener("agent_message", handleEvent("agent_message"));
      const orchEvents = [
        "orchestration_start",
        "orchestration_step",
        "orchestration_progress",
        "orchestration_complete",
        "orchestration_error",
      ];
      for (const evt of orchEvents) {
        es.addEventListener(evt, handleEvent(evt));
      }
      es.onerror = () => {
        console.warn("SSE: connection lost, reconnecting in 5s");
        es.close();
        timer = setTimeout(connect, 5000);
      };
      eventSourceRef.current = es;
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      eventSourceRef.current?.close();
    };
  }, [url]);
}
