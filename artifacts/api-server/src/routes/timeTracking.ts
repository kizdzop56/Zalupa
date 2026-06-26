import { Router } from "express";
import { db } from "@workspace/db";
import { timeSessionsTable, usersTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

router.post("/time-tracking/start", requireAuth, async (req, res) => {
  const user = getUser(req);

  const openSessions = await db.select().from(timeSessionsTable)
    .where(and(eq(timeSessionsTable.studentId, user.userId), isNull(timeSessionsTable.endedAt)));

  for (const session of openSessions) {
    const durationMinutes = Math.round((Date.now() - session.startedAt.getTime()) / 60000);
    await db.update(timeSessionsTable)
      .set({ endedAt: new Date(), durationMinutes })
      .where(eq(timeSessionsTable.id, session.id));
  }

  const [session] = await db.insert(timeSessionsTable).values({ studentId: user.userId }).returning();
  res.json(session);
});

router.post("/time-tracking/end", requireAuth, async (req, res) => {
  const user = getUser(req);

  const [openSession] = await db.select().from(timeSessionsTable)
    .where(and(eq(timeSessionsTable.studentId, user.userId), isNull(timeSessionsTable.endedAt)));

  if (!openSession) {
    res.json({ message: "No open session" });
    return;
  }

  const durationMinutes = Math.round((Date.now() - openSession.startedAt.getTime()) / 60000);

  await db.update(timeSessionsTable)
    .set({ endedAt: new Date(), durationMinutes })
    .where(eq(timeSessionsTable.id, openSession.id));

  // Persist accumulated session minutes to user record so they're saved on logout
  if (durationMinutes > 0) {
    const [u] = await db.select({ t: usersTable.totalTimeMinutes })
      .from(usersTable).where(eq(usersTable.id, user.userId));
    await db.update(usersTable)
      .set({ totalTimeMinutes: (u?.t ?? 0) + durationMinutes })
      .where(eq(usersTable.id, user.userId));
  }

  res.json({ ok: true, durationMinutes });
});

router.get("/students/:id/time", requireAuth, async (req, res) => {
  const studentId = Number(req.params["id"]);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());

  const [user] = await db.select({ totalTimeMinutes: usersTable.totalTimeMinutes })
    .from(usersTable).where(eq(usersTable.id, studentId));

  const sessions = await db.select().from(timeSessionsTable)
    .where(eq(timeSessionsTable.studentId, studentId));

  const sessionMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const totalMinutes = (user?.totalTimeMinutes ?? 0) + sessionMinutes;
  const todayMinutes = sessions.filter(s => s.startedAt >= todayStart)
    .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const weekMinutes = sessions.filter(s => s.startedAt >= weekStart)
    .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  res.json({ totalMinutes, todayMinutes, weekMinutes, sessions });
});

export default router;
