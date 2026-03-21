import express from "express";
import cors from "cors";
import helmet from "helmet";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { authRouter } from "./auth/routes.js";
import { agentsRouter } from "./agents/routes.js";
import { agentMonitor } from "./agents/monitor.js";
import { sseRouter } from "./sse/routes.js";
import { relayRouter } from "./agents/relay.js";
import { proxyRouter } from "./agents/proxy.js";
import { skillsRouter } from "./skills/routes.js";
import { skillProvidersRouter } from "./skills/providers/routes.js";
import { pluginsRouter } from "./plugins/routes.js";
import { settingsRouter } from "./settings/routes.js";
import { taskDispatchRouter } from "./tasks/routes.js";
import { usersRouter } from "./users/routes.js";
import { keysRouter } from "./keys/routes.js";
import { cronsRouter } from "./crons/routes.js";
import { connectRouter } from "./agents/connect.js";
import { tailscaleRouter } from "./tailscale/routes.js";
import { seedPluginRegistry } from "./db/seed-registry.js";
import { seedAdminUser } from "./db/seed-admin.js";
import { pluginRegistryRouter } from "./plugin-registry/routes.js";
import { templatesRouter } from "./templates/routes.js";
import { apiLimiter, authLimiter, connectLimiter } from "./middleware/rate-limit.js";
import { auditRouter } from "./audit/routes.js";
import { delegationRouter } from "./delegation/routes.js";
import { workflowsRouter } from "./workflows/routes.js";
import { corsRouter, isOriginAllowed, loadCorsOrigins } from "./cors.js";
import { wsManager } from "./ws/manager.js";
import { stateRouter } from "./memory/state-routes.js";
import { knowledgeRouter } from "./memory/knowledge-routes.js";
import { sandboxRouter } from "./sandbox/routes.js";

// Prevent process crashes on unhandled errors
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

const app = express();
if (!config.jwtSecret || config.jwtSecret.length < 32) {
  console.error("FATAL: JWT_SECRET must be set and at least 32 characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\"");
  process.exit(1);
}
seedPluginRegistry();
seedAdminUser();
loadCorsOrigins();
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin)) return callback(null, true);
    callback(new Error("CORS: origin not allowed"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", authLimiter);
app.use("/api/agents/connect", connectLimiter);
app.use("/api/", apiLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "0.1.0" });
});

app.use("/api/agents/connect", connectRouter); // Public — agent auth via API key in body
app.use("/api/auth", authRouter);
// Mount proxy BEFORE agentsRouter so /:agentId/tasks doesn't collide with /:id
app.use("/api/agents", proxyRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/sse", sseRouter);
app.use("/api/relay", relayRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/skill-providers", skillProvidersRouter);
app.use("/api/plugins", pluginsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/cors-origins", corsRouter);
app.use("/api/tasks", taskDispatchRouter);
app.use("/api/users", usersRouter);
app.use("/api/keys", keysRouter);
app.use("/api/crons", cronsRouter);
app.use("/api/tailscale", tailscaleRouter);
app.use("/api/plugin-registry", pluginRegistryRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/audit-logs", auditRouter);
app.use("/api/memory", stateRouter);
app.use("/api/memory", knowledgeRouter);
app.use("/api/sandbox", sandboxRouter);
app.use("/api/workflows", workflowsRouter);
app.use("/api", delegationRouter); // Must be AFTER specific /api/* routes — mounted at /api so its middleware runs on all /api/* paths

// Global error handler — catches unhandled errors in route handlers
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? "Internal server error" : (err.message || "Something went wrong");
  if (status === 500) {
    console.error("Unhandled server error:", err);
  }
  res.status(status).json({ error: message });
});

// Serve React frontend (built client)
const clientDist = path.join(__dirname, "../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("{*path}", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Only start listening when not imported for testing
if (!process.env.VITEST) {
  let listenHost = config.host;
  if (config.tailscaleEnabled && config.tailscaleMode === "tailscale-only") {
    try {
      listenHost = execFileSync("tailscale", ["ip", "-4"]).toString().trim();
      console.log(`Tailscale-only mode: binding to ${listenHost}`);
    } catch {
      console.warn("Tailscale IP resolution failed, falling back to configured host");
    }
  }

  if (config.tlsCert && config.tlsKey) {
    const sslOptions = {
      cert: fs.readFileSync(config.tlsCert),
      key: fs.readFileSync(config.tlsKey),
    };
    const server = https.createServer(sslOptions, app);
    server.listen(config.port, listenHost, () => {
      console.log(`MultiClaw Dashboard (HTTPS) on ${listenHost}:${config.port}`);
    });
    wsManager.init(server);
  } else {
    const server = app.listen(config.port, listenHost, () => {
      console.log(`MultiClaw Dashboard on ${listenHost}:${config.port}`);
    });
    wsManager.init(server);
  }
  agentMonitor.start();
}

export { app };
