import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, submissionsTable, timeSessionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, getUser } from "../lib/auth";

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
    totalPoints: usersTable.totalPoints,
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

  // Get stats for students
  let totalTimeMinutes = 0;
  let completedAssignments = 0;
  let averageScore: number | null = null;

  if (user.role === "student") {
    const timeSessions = await db.select({ duration: timeSessionsTable.durationMinutes })
      .from(timeSessionsTable).where(eq(timeSessionsTable.studentId, id));
    totalTimeMinutes = timeSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    const submissions = await db.select({ score: submissionsTable.score })
      .from(submissionsTable).where(eq(submissionsTable.studentId, id));
    completedAssignments = submissions.length;
    if (submissions.length > 0) {
      averageScore = submissions.reduce((sum, s) => sum + s.score, 0) / submissions.length;
    }
  }

  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    age: user.age,
    totalPoints: user.totalPoints,
    createdAt: user.createdAt,
    totalTimeMinutes,
    completedAssignments,
    averageScore,
  });
});

router.patch("/users/:id", requireAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  const { name, age } = req.body;

  const [updated] = await db.update(usersTable)
    .set({ name, age, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning();

  res.json({
    id: updated.id,
    username: updated.username,
    name: updated.name,
    role: updated.role,
    age: updated.age,
    totalPoints: updated.totalPoints,
    createdAt: updated.createdAt,
  });
});

router.get("/users/:id/children", requireAuth, async (req, res) => {
  const parentId = Number(req.params["id"]);
  const children = await db.select().from(usersTable)
    .where(and(eq(usersTable.parentId, parentId), eq(usersTable.role, "student")));

  const result = await Promise.all(children.map(async (child) => {
    const timeSessions = await db.select({ duration: timeSessionsTable.durationMinutes })
      .from(timeSessionsTable).where(eq(timeSessionsTable.studentId, child.id));
    const totalTimeMinutes = timeSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    const submissions = await db.select({ score: submissionsTable.score })
      .from(submissionsTable).where(eq(submissionsTable.studentId, child.id));
    const completedAssignments = submissions.length;
    const averageScore = submissions.length > 0
      ? submissions.reduce((sum, s) => sum + s.score, 0) / submissions.length
      : null;

    return {
      id: child.id,
      username: child.username,
      name: child.name,
      role: child.role,
      age: child.age,
      totalPoints: child.totalPoints,
      createdAt: child.createdAt,
      totalTimeMinutes,
      completedAssignments,
      averageScore,
    };
  }));

  res.json(result);
});

export default router;
