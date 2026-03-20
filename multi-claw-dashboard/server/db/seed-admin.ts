import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { db } from "./index.js";
import { users } from "./schema.js";
import { config } from "../config.js";

export async function seedAdminUser(): Promise<void> {
  const allUsers = db.select().from(users).all();
  if (allUsers.length > 0) return; // Users already exist

  if (!config.adminEmail || !config.adminPassword) return; // No admin credentials configured

  const id = uuid();
  const passwordHash = await bcrypt.hash(config.adminPassword, 12);
  db.insert(users).values({
    id,
    email: config.adminEmail,
    passwordHash,
    name: "Admin",
    role: "admin",
  }).run();

  console.log(`Admin user created: ${config.adminEmail}`);
}
