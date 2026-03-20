import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { requireAuth, requireRole } from "../auth/middleware.js";

const router = Router();
router.use(requireAuth);
router.use(requireRole("canManageUsers"));

// List all users
router.get("/", async (_req, res) => {
  const allUsers = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .all();
  res.json(allUsers);
});

// Update user role
router.patch("/:id/role", async (req, res) => {
  const { role } = req.body;
  if (!role || !["admin", "operator", "viewer"].includes(role)) {
    return res.status(400).json({ error: "Invalid role. Must be admin, operator, or viewer." });
  }

  const user = db.select().from(users).where(eq(users.id, req.params.id)).get();
  if (!user) return res.status(404).json({ error: "User not found" });

  // Prevent demoting yourself
  if (req.params.id === req.user!.id && role !== "admin") {
    return res.status(400).json({ error: "Cannot change your own role" });
  }

  db.update(users).set({ role }).where(eq(users.id, req.params.id)).run();
  res.json({ success: true, role });
});

// Delete user
router.delete("/:id", async (req, res) => {
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: "Cannot delete yourself" });
  }

  const user = db.select().from(users).where(eq(users.id, req.params.id)).get();
  if (!user) return res.status(404).json({ error: "User not found" });

  db.delete(users).where(eq(users.id, req.params.id)).run();
  res.json({ success: true });
});

export { router as usersRouter };
