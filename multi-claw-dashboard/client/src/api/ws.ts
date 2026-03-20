import { useEffect, useRef, useCallback } from "react";

type EventHandler = (event: string, data: any) => void;

export function useWebSocket(handler: EventHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const backoff = useRef(1000);
  const sendQueue = useRef<string[]>([]);
  const wasConnected = useRef(false);

  const send = useCallback((data: unknown) => {
    const payload = JSON.stringify(data);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload);
    } else {
      sendQueue.current.push(payload);
    }
  }, []);

  const connect = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      backoff.current = 1000; // Reset backoff on successful connect
      // Flush queued messages
      while (sendQueue.current.length > 0) {
        const msg = sendQueue.current.shift()!;
        ws.send(msg);
      }
      // Emit connection_restored if this is a reconnect
      if (wasConnected.current) {
        handlerRef.current("connection_restored", {});
      }
      wasConnected.current = true;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type && msg.type !== "connected") {
          handlerRef.current(msg.type, msg.data);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      // Reconnect with exponential backoff: 1s, 2s, 4s, 8s, max 30s
      reconnectTimer.current = setTimeout(() => {
        backoff.current = Math.min(backoff.current * 2, 30000);
        connect();
      }, backoff.current);
    };

    ws.onerror = () => {
      ws.close(); // Triggers onclose -> reconnect
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { send };
}
