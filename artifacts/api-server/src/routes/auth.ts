import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateToken, requireAuth, getUser } from "../lib/auth";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Missing username or password" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = generateToken({ userId: user.id, role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      age: user.age,
      totalPoints: user.totalPoints,
      createdAt: user.createdAt,
    },
  });
});

router.post("/auth/register", async (req, res) => {
  const { username, password, name, role, age, parentId } = req.body;

  if (!username || !password || !name || !role) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!["student", "parent"].includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  if (role === "student" && (!age || age < 5 || age > 18)) {
    res.status(400).json({ error: "Students must have an age between 5 and 18" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db.insert(usersTable).values({
    username,
    passwordHash,
    name,
    role,
    age: role === "student" ? age : null,
    parentId: role === "student" && parentId ? parentId : null,
    totalPoints: 0,
  }).returning();

  const token = generateToken({ userId: user.id, role: user.role });
  res.status(201).json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      age: user.age,
      totalPoints: user.totalPoints,
      createdAt: user.createdAt,
    },
  });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const { userId } = getUser(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    age: user.age,
    totalPoints: user.totalPoints,
    createdAt: user.createdAt,
  });
});

export default router;
