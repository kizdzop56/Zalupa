import { Router } from "express";
import { db } from "@workspace/db";
import { timeSessionsTable } from "@workspace/db";
import { eq, and, gte, isNull } from "drizzle-orm";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

router.post("/time-tracking/start", requireAuth, async (req, res) => {
  const user = getUser(req);

  // End any existing open sessions
  const openSessions = await db.select().from(timeSessionsTable)
    .where(and(eq(timeSessionsTable.studentId, user.userId), isNull(timeSessionsTable.endedAt)));

  for (const session of openSessions) {
    const durationMs = Date.now() - session.startedAt.getTime();
    const durationMinutes = Math.round(durationMs / 60000);
    await db.update(timeSessionsTable)
      .set({ endedAt: new Date(), durationMinutes })
      .where(eq(timeSessionsTable.id, session.id));
  }

  const [session] = await db.insert(timeSessionsTable).values({
    studentId: user.userId,
  }).returning();

  res.json(session);
});

router.post("/time-tracking/end", requireAuth, async (req, res) => {
  const user = getUser(req);

  const [openSession] = await db.select().from(timeSessionsTable)
    .where(and(eq(timeSessionsTable.studentId, user.userId), isNull(timeSessionsTable.endedAt)));

  if (!openSession) {
    res.json({ message: "No open session found" });
    return;
  }

  const durationMs = Date.now() - openSession.startedAt.getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  const [updated] = await db.update(timeSessionsTable)
    .set({ endedAt: new Date(), durationMinutes })
    .where(eq(timeSessionsTable.id, openSession.id))
    .returning();

  res.json(updated);
});

router.get("/students/:id/time", requireAuth, async (req, res) => {
  const studentId = Number(req.params["id"]);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());

  const sessions = await db.select().from(timeSessionsTable)
    .where(eq(timeSessionsTable.studentId, studentId));

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const todayMinutes = sessions
    .filter(s => s.startedAt >= todayStart)
    .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const weekMinutes = sessions
    .filter(s => s.startedAt >= weekStart)
    .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  res.json({
    totalMinutes,
    todayMinutes,
    weekMinutes,
    sessions,
  });
});

export default router;
