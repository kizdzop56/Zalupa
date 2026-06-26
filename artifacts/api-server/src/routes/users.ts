import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, submissionsTable, timeSessionsTable, assignmentsTable } from "@workspace/db";
import { eq, and, sql, desc, isNull, inArray } from "drizzle-orm";
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
    // Add only the CURRENT open session (closed sessions are already in user.totalTimeMinutes)
    const [openSession] = await db.select()
      .from(timeSessionsTable)
      .where(and(eq(timeSessionsTable.studentId, id), isNull(timeSessionsTable.endedAt)));
    const openMinutes = openSession
      ? Math.floor((Date.now() - openSession.startedAt.getTime()) / 60000)
      : 0;
    totalTimeMinutes = (user.totalTimeMinutes ?? 0) + openMinutes;

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

// ── Teacher: view student's submission history ────────────────────────
router.get("/students/:id/submissions", requireAuth, async (req, res) => {
  const caller = getUser(req);
  const studentId = Number(req.params["id"]);

  if (!isTeacher(caller.role) && caller.role !== "admin" && caller.userId !== studentId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const rows = await db.select({
    submissionId: submissionsTable.id,
    score: submissionsTable.score,
    correctCount: submissionsTable.correctCount,
    totalQuestions: submissionsTable.totalQuestions,
    pointsEarned: submissionsTable.pointsEarned,
    submittedAt: submissionsTable.submittedAt,
    assignmentId: assignmentsTable.id,
    title: assignmentsTable.title,
    type: assignmentsTable.type,
    points: assignmentsTable.points,
  })
    .from(submissionsTable)
    .leftJoin(assignmentsTable, eq(submissionsTable.assignmentId, assignmentsTable.id))
    .where(eq(submissionsTable.studentId, studentId))
    .orderBy(desc(submissionsTable.submittedAt));

  res.json(rows);
});

// ── Teacher: per-category score stats for a student ───────────────────
router.get("/students/:id/category-stats", requireAuth, async (req, res) => {
  const caller = getUser(req);
  const studentId = Number(req.params["id"]);

  if (!isTeacher(caller.role) && caller.role !== "admin" && caller.userId !== studentId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const rows = await db.select({
    score: submissionsTable.score,
    type: assignmentsTable.type,
  })
    .from(submissionsTable)
    .leftJoin(assignmentsTable, eq(submissionsTable.assignmentId, assignmentsTable.id))
    .where(eq(submissionsTable.studentId, studentId));

  const CATEGORIES = ["text_test", "audio", "reading", "video"] as const;
  const stats = CATEGORIES.map((cat) => {
    const catRows = rows.filter((r) => r.type === cat);
    const avgScore = catRows.length > 0
      ? Math.round(catRows.reduce((s, r) => s + (r.score ?? 0), 0) / catRows.length)
      : null;
    return { type: cat, avgScore, count: catRows.length };
  });

  res.json(stats);
});

export default router;
