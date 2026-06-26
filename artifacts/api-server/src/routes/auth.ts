import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateToken, requireAuth, getUser } from "../lib/auth";
import { calculateAge, getKnowledgeLevel } from "../lib/knowledgeLevel";
import { generateInviteCode } from "../lib/inviteCode";

const router = Router();

const PUBLIC_USER_FIELDS = (u: typeof usersTable.$inferSelect) => ({
  id: u.id,
  username: u.username,
  name: u.name,
  role: u.role,
  age: u.age,
  dateOfBirth: u.dateOfBirth,
  knowledgeLevel: u.knowledgeLevel,
  totalPoints: u.totalPoints,
  totalTimeMinutes: u.totalTimeMinutes,
  avatarEmoji: u.avatarEmoji,
  avatarColor: u.avatarColor,
  bio: u.bio,
  inviteCode: u.inviteCode,
  createdAt: u.createdAt,
});

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

  // Backfill invite code if missing (for existing users)
  if (!user.inviteCode) {
    let code = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const [clash] = await db.select({ id: usersTable.id })
        .from(usersTable).where(eq(usersTable.inviteCode, code));
      if (!clash) break;
      code = generateInviteCode();
      attempts++;
    }
    await db.update(usersTable).set({ inviteCode: code }).where(eq(usersTable.id, user.id));
    user.inviteCode = code;
  }

  const token = generateToken({ userId: user.id, role: user.role });
  res.json({ token, user: PUBLIC_USER_FIELDS(user) });
});

router.post("/auth/register", async (req, res) => {
  const { username, password, name, role, dateOfBirth, parentId } = req.body;

  if (!username || !password || !name || !role) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!["student", "parent", "teacher"].includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be student, parent, or teacher." });
    return;
  }

  let age: number | null = null;
  let knowledgeLevel: string | null = null;

  if (role === "student") {
    if (!dateOfBirth) {
      res.status(400).json({ error: "Date of birth is required for students" });
      return;
    }
    age = calculateAge(dateOfBirth);
    if (age < 5 || age > 18) {
      res.status(400).json({ error: "Student age must be between 5 and 18 years" });
      return;
    }
    knowledgeLevel = getKnowledgeLevel(age);
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  // Generate unique invite code
  let inviteCode = generateInviteCode();
  let attempts = 0;
  while (attempts < 10) {
    const [clash] = await db.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.inviteCode, inviteCode));
    if (!clash) break;
    inviteCode = generateInviteCode();
    attempts++;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const dbRole = role as "student" | "parent" | "teacher";

  const [user] = await db.insert(usersTable).values({
    username,
    passwordHash,
    name,
    role: dbRole,
    age,
    dateOfBirth: dateOfBirth ?? null,
    knowledgeLevel: knowledgeLevel as any ?? null,
    parentId: role === "student" && parentId ? parentId : null,
    totalPoints: 0,
    inviteCode,
  }).returning();

  const token = generateToken({ userId: user.id, role: user.role });
  res.status(201).json({ token, user: PUBLIC_USER_FIELDS(user) });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const { userId } = getUser(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(PUBLIC_USER_FIELDS(user));
});

export default router;
