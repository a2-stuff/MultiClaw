import crypto from "crypto";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { db } from "./index.js";
import { users } from "./schema.js";
import { config } from "../config.js";

export async function seedAdminUser(): Promise<void> {
  const allUsers = db.select().from(users).all();
  if (allUsers.length > 0) return; // Users already exist

  const email = config.adminEmail;
  const password = config.adminPassword || crypto.randomBytes(16).toString("base64url");
  const generated = !config.adminPassword;

  const id = uuid();
  const passwordHash = await bcrypt.hash(password, 12);
  db.insert(users).values({
    id,
    email,
    passwordHash,
    name: "Admin",
    role: "admin",
  }).run();

  console.log(`Admin user created: ${email}`);
  if (generated) {
    console.log(`Generated admin password: ${password.slice(0, 3)}${"*".repeat(password.length - 3)} (check .env to retrieve)`);
    console.log("Save this password — it will not be shown again.");
  }
}
