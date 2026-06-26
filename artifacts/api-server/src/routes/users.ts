import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, submissionsTable, timeSessionsTable, assignmentsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth, getUser, isTeacher } from "../lib/auth";

const router = Router();

router.get("/users", requireAuth, async (req, res) => {
  const { role, parentId } = req.query;

  let conditions: any[] = [];
  if (role) conditions.push(eq(usersTable.role, role as any));
  if (parentId) conditions.push(eq(usersTable.parentId, Number(parentId)));

  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    name: usersTable.name,
    role: usersTable.role,
    age: usersTable.age,
    knowledgeLevel: usersTable.knowledgeLevel,
    avatarEmoji: usersTable.avatarEmoji,
    avatarColor: usersTable.avatarColor,
    totalPoints: usersTable.totalPoints,
    totalTimeMinutes: usersTable.totalTimeMinutes,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json(users);
});

router.get("/users/:id", requireAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let totalTimeMinutes = user.totalTimeMinutes ?? 0;
  let completedAssignments = 0;
  let averageScore: number | null = null;

  if (user.role === "student") {
    // Add current session time from DB
    const timeSessions = await db.select({ duration: timeSessionsTable.durationMinutes })
      .from(timeSessionsTable).where(eq(timeSessionsTable.studentId, id));
    const sessionMinutes = timeSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    totalTimeMinutes = (user.totalTimeMinutes ?? 0) + sessionMinutes;

    const submissions = await db.select({ score: submissionsTable.score })
      .from(submissionsTable).where(eq(submissionsTable.studentId, id));
    completedAssignments = submissions.length;
    if (submissions.length > 0) {
      averageScore = Math.round(submissions.reduce((sum, s) => sum + s.score, 0) / submissions.length);
    }
  }

  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    age: user.age,
    dateOfBirth: user.dateOfBirth,
    knowledgeLevel: user.knowledgeLevel,
    avatarEmoji: user.avatarEmoji,
    avatarColor: user.avatarColor,
    bio: user.bio,
    totalPoints: user.totalPoints,
    totalTimeMinutes,
    completedAssignments,
    averageScore,
    createdAt: user.createdAt,
  });
});

// Update profile (bio, avatar)
router.patch("/users/:id/profile", requireAuth, async (req, res) => {
  const caller = getUser(req);
  const id = Number(req.params["id"]);

  // Can only update own profile (or admin/teacher can update anyone)
  if (caller.userId !== id && !isTeacher(caller.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { bio, avatarEmoji, avatarColor, name } = req.body;

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (bio !== undefined) updateData.bio = bio;
  if (avatarEmoji !== undefined) updateData.avatarEmoji = avatarEmoji;
  if (avatarColor !== undefined) updateData.avatarColor = avatarColor;
  if (name !== undefined && name.trim()) updateData.name = name.trim();

  const [updated] = await db.update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, id))
    .returning();

  res.json({
    id: updated.id,
    username: updated.username,
    name: updated.name,
    bio: updated.bio,
    avatarEmoji: updated.avatarEmoji,
    avatarColor: updated.avatarColor,
    role: updated.role,
  });
});

// Get parent's children
router.get("/users/:id/children", requireAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  const children = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    name: usersTable.name,
    role: usersTable.role,
    age: usersTable.age,
    knowledgeLevel: usersTable.knowledgeLevel,
    avatarEmoji: usersTable.avatarEmoji,
    avatarColor: usersTable.avatarColor,
    totalPoints: usersTable.totalPoints,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.parentId, id));
  res.json(children);
});

export default router;
