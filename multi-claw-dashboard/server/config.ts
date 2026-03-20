import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000"),
  host: process.env.HOST || "0.0.0.0",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  dbPath: process.env.DB_PATH || "./data/multiclaw.db",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173").split(",").map(s => s.trim()),
  tlsCert: process.env.TLS_CERT || "",
  tlsKey: process.env.TLS_KEY || "",
  tailscaleEnabled: process.env.MULTICLAW_TAILSCALE_ENABLED === "true",
  tailscaleMode: process.env.MULTICLAW_TAILSCALE_MODE || "dual-stack",
  tailscaleTag: process.env.MULTICLAW_TAILSCALE_TAG || "tag:multiclaw-dashboard",
  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
};
