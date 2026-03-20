import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

// Set test DB path before importing app
process.env.DB_PATH = "./data/test-multiclaw.db";
process.env.VITEST = "true";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "../../server/index.js";
import { db } from "../../server/db/index.js";
import { users, agentTasks, agentSkills, agentPlugins, agents, skills, plugins } from "../../server/db/schema.js";

beforeAll(() => {
  // Run migrations on the test DB (idempotent)
  migrate(db, { migrationsFolder: "./drizzle" });
  // Clean up in FK-safe order
  db.delete(agentTasks).run();
  db.delete(agentSkills).run();
  db.delete(agentPlugins).run();
  db.delete(agents).run();
  db.delete(skills).run();
  db.delete(plugins).run();
  db.delete(users).run();
});

describe("Auth", () => {
  it("POST /api/auth/register creates a user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "admin@test.com", password: "Test1234!", name: "Admin" });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("admin@test.com");
    expect(res.body.token).toBeDefined();
  });

  it("POST /api/auth/login returns JWT", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "Test1234!" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("POST /api/auth/login rejects wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me requires auth", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
