import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

interface WSClient {
  id: string;
  userId: string;
  ws: WebSocket;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  init(server: import("http").Server | import("https").Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });
    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients.values()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    }, 15_000);
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    // Extract token from query string
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    if (!token) {
      ws.close(4001, "Missing token");
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret) as { id: string; email: string; role: string };
      const clientId = crypto.randomUUID();
      const client: WSClient = { id: clientId, userId: payload.id, ws };
      this.clients.set(clientId, client);

      ws.send(JSON.stringify({ type: "connected", data: { clientId } }));

      ws.on("close", () => {
        this.clients.delete(clientId);
      });

      ws.on("message", (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(client, msg);
        } catch {
          // Ignore malformed messages
        }
      });
    } catch {
      ws.close(4003, "Invalid token");
    }
  }

  private handleMessage(_client: WSClient, _msg: unknown) {
    // Placeholder for bidirectional commands — Phase 1 is broadcast-only
    // Future: handle { type: "command", action: "task.create", data: {...} }
  }

  broadcast(event: string, data: unknown) {
    const payload = JSON.stringify({ type: event, data, timestamp: new Date().toISOString() });
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  sendTo(clientId: string, event: string, data: unknown) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ type: event, data, timestamp: new Date().toISOString() }));
    }
  }

  get connectionCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WebSocketManager();
