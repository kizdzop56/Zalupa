import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, submissionsTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/leaderboard", requireAuth, async (req, res) => {
  const students = await db.select({
    userId: usersTable.id,
    name: usersTable.name,
    totalPoints: usersTable.totalPoints,
  }).from(usersTable)
    .where(eq(usersTable.role, "student"))
    .orderBy(desc(usersTable.totalPoints));

  const withCounts = await Promise.all(students.map(async (s) => {
    const [result] = await db.select({ count: count() }).from(submissionsTable)
      .where(eq(submissionsTable.studentId, s.userId));
    return {
      ...s,
      completedAssignments: result?.count || 0,
    };
  }));

  res.json(withCounts.map((s, i) => ({ ...s, rank: i + 1 })));
});

export default router;
