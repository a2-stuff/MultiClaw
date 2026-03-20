import type { Config } from "drizzle-kit";
export default {
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: process.env.DB_PATH || "./data/multiclaw.db" },
} satisfies Config;
