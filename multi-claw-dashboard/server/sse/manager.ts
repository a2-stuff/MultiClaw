import { Response } from "express";

interface SSEClient { id: string; userId: string; res: Response; }

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients.values()) {
        client.res.write(`:ping\n\n`);
      }
    }, 15_000);
  }

  addClient(id: string, userId: string, res: Response) {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);
    this.clients.set(id, { id, userId, res });
    res.on("close", () => { this.clients.delete(id); });
  }

  broadcast(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) { client.res.write(payload); }
  }

  sendTo(clientId: string, event: string, data: unknown) {
    const client = this.clients.get(clientId);
    if (client) client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  get connectionCount(): number { return this.clients.size; }
}

export const sseManager = new SSEManager();
