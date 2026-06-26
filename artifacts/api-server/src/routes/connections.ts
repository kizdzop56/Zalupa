import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, teacherStudentsTable, parentChildrenTable, friendshipsTable, submissionsTable,
} from "@workspace/db";
import { eq, and, or, inArray } from "drizzle-orm";
import { requireAuth, getUser, isTeacher } from "../lib/auth";

const router = Router();

// ── Find user by invite code ─────────────────────────────────────────
router.get("/connections/by-code/:code", requireAuth, async (req, res) => {
  const code = (req.params["code"] as string).toUpperCase();
  const [user] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    username: usersTable.username,
    role: usersTable.role,
    knowledgeLevel: usersTable.knowledgeLevel,
    avatarEmoji: usersTable.avatarEmoji,
    avatarColor: usersTable.avatarColor,
    inviteCode: usersTable.inviteCode,
  }).from(usersTable).where(eq(usersTable.inviteCode, code));

  if (!user) {
    res.status(404).json({ error: "Пользователь с таким кодом не найден" });
    return;
  }
  res.json(user);
});

// ── Teacher: send request to student ────────────────────────────────
router.post("/connections/teacher/add-student", requireAuth, async (req, res) => {
  const caller = getUser(req);
  if (!isTeacher(caller.role)) {
    res.status(403).json({ error: "Только учитель может добавлять учеников" });
    return;
  }

  const { code } = req.body as { code: string };
  if (!code) { res.status(400).json({ error: "Код обязателен" }); return; }

  const [student] = await db.select().from(usersTable)
    .where(eq(usersTable.inviteCode, code.toUpperCase()));

  if (!student) {
    res.status(404).json({ error: "Ученик с таким кодом не найден" }); return;
  }
  if (student.role !== "student") {
    res.status(400).json({ error: "Этот пользователь не является учеником" }); return;
  }

  // Check duplicate
  const [existing] = await db.select().from(teacherStudentsTable)
    .where(and(
      eq(teacherStudentsTable.teacherId, caller.userId),
      eq(teacherStudentsTable.studentId, student.id),
    ));
  if (existing) {
    const msg = existing.status === "pending"
      ? "Запрос уже отправлен, ожидается подтверждение ученика"
      : "Этот ученик уже прикреплён к вам";
    res.status(400).json({ error: msg }); return;
  }

  await db.insert(teacherStudentsTable).values({
    teacherId: caller.userId,
    studentId: student.id,
    status: "pending",
  });

  res.status(201).json({
    id: student.id,
    name: student.name,
    username: student.username,
    avatarEmoji: student.avatarEmoji,
    avatarColor: student.avatarColor,
    knowledgeLevel: student.knowledgeLevel,
    status: "pending",
  });
});

// ── Teacher: get my students (accepted only) ─────────────────────────
router.get("/connections/teacher/students", requireAuth, async (req, res) => {
  const caller = getUser(req);
  if (!isTeacher(caller.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const links = await db.select({ studentId: teacherStudentsTable.studentId })
    .from(teacherStudentsTable)
    .where(and(
      eq(teacherStudentsTable.teacherId, caller.userId),
      eq(teacherStudentsTable.status, "accepted"),
    ));

  if (links.length === 0) { res.json([]); return; }

  const ids = links.map((l) => l.studentId);
  const students = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    username: usersTable.username,
    role: usersTable.role,
    knowledgeLevel: usersTable.knowledgeLevel,
    avatarEmoji: usersTable.avatarEmoji,
    avatarColor: usersTable.avatarColor,
    totalPoints: usersTable.totalPoints,
    inviteCode: usersTable.inviteCode,
  }).from(usersTable).where(inArray(usersTable.id, ids));

  res.json(students);
});

// ── Teacher: get pending outgoing requests ───────────────────────────
router.get("/connections/teacher/pending", requireAuth, async (req, res) => {
  const caller = getUser(req);
  if (!isTeacher(caller.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const links = await db.select({
    id: teacherStudentsTable.id,
    studentId: teacherStudentsTable.studentId,
  }).from(teacherStudentsTable).where(and(
    eq(teacherStudentsTable.teacherId, caller.userId),
    eq(teacherStudentsTable.status, "pending"),
  ));

  if (links.length === 0) { res.json([]); return; }

  const ids = links.map((l) => l.studentId);
  const students = await db.select({
    id: usersTable.id, name: usersTable.name, username: usersTable.username,
    avatarEmoji: usersTable.avatarEmoji, avatarColor: usersTable.avatarColor,
    knowledgeLevel: usersTable.knowledgeLevel,
  }).from(usersTable).where(inArray(usersTable.id, ids));

  const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));

  res.json(links.map((l) => ({
    requestId: l.id,
    student: studentMap[l.studentId],
    status: "pending",
  })));
});

// ── Teacher: remove student (or cancel pending request) ───────────────
router.delete("/connections/teacher/students/:studentId", requireAuth, async (req, res) => {
  const caller = getUser(req);
  if (!isTeacher(caller.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(teacherStudentsTable).where(and(
    eq(teacherStudentsTable.teacherId, caller.userId),
    eq(teacherStudentsTable.studentId, Number(req.params["studentId"])),
  ));
  res.json({ ok: true });
});

// ── Student: get incoming teacher requests ───────────────────────────
router.get("/connections/student/teacher-requests", requireAuth, async (req, res) => {
  const caller = getUser(req);

  const links = await db.select({
    id: teacherStudentsTable.id,
    teacherId: teacherStudentsTable.teacherId,
  }).from(teacherStudentsTable).where(and(
    eq(teacherStudentsTable.studentId, caller.userId),
    eq(teacherStudentsTable.status, "pending"),
  ));

  if (links.length === 0) { res.json([]); return; }

  const ids = links.map((l) => l.teacherId);
  const teachers = await db.select({
    id: usersTable.id, name: usersTable.name, username: usersTable.username,
    avatarEmoji: usersTable.avatarEmoji, avatarColor: usersTable.avatarColor,
    role: usersTable.role,
  }).from(usersTable).where(inArray(usersTable.id, ids));

  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));

  res.json(links.map((l) => ({
    requestId: l.id,
    teacher: teacherMap[l.teacherId],
  })));
});

// ── Student: accept teacher request ─────────────────────────────────
router.patch("/connections/student/teacher-requests/:id/accept", requireAuth, async (req, res) => {
  const caller = getUser(req);
  const id = Number(req.params["id"]);

  const [link] = await db.select().from(teacherStudentsTable)
    .where(eq(teacherStudentsTable.id, id));
  if (!link) { res.status(404).json({ error: "Запрос не найден" }); return; }
  if (link.studentId !== caller.userId) {
    res.status(403).json({ error: "Нельзя принять чужой запрос" }); return;
  }

  await db.update(teacherStudentsTable)
    .set({ status: "accepted" })
    .where(eq(teacherStudentsTable.id, id));
  res.json({ ok: true });
});

// ── Student: decline teacher request ────────────────────────────────
router.delete("/connections/student/teacher-requests/:id", requireAuth, async (req, res) => {
  const caller = getUser(req);
  const id = Number(req.params["id"]);

  const [link] = await db.select().from(teacherStudentsTable)
    .where(eq(teacherStudentsTable.id, id));
  if (!link) { res.status(404).json({ error: "Запрос не найден" }); return; }
  if (link.studentId !== caller.userId) {
    res.status(403).json({ error: "Нельзя отклонить чужой запрос" }); return;
  }

  await db.delete(teacherStudentsTable).where(eq(teacherStudentsTable.id, id));
  res.json({ ok: true });
});

// ── Parent: add child by code ────────────────────────────────────────
router.post("/connections/parent/add-child", requireAuth, async (req, res) => {
  const caller = getUser(req);
  if (caller.role !== "parent") {
    res.status(403).json({ error: "Только родитель может добавлять детей" }); return;
  }

  const { code } = req.body as { code: string };
  if (!code) { res.status(400).json({ error: "Код обязателен" }); return; }

  const [student] = await db.select().from(usersTable)
    .where(eq(usersTable.inviteCode, code.toUpperCase()));

  if (!student) {
    res.status(404).json({ error: "Ученик с таким кодом не найден" }); return;
  }
  if (student.role !== "student") {
    res.status(400).json({ error: "Этот пользователь не является учеником" }); return;
  }

  const [existing] = await db.select().from(parentChildrenTable)
    .where(and(
      eq(parentChildrenTable.parentId, caller.userId),
      eq(parentChildrenTable.studentId, student.id),
    ));
  if (existing) {
    res.status(400).json({ error: "Этот ребёнок уже добавлен" }); return;
  }

  await db.insert(parentChildrenTable).values({
    parentId: caller.userId,
    studentId: student.id,
  });

  res.status(201).json({
    id: student.id,
    name: student.name,
    username: student.username,
    avatarEmoji: student.avatarEmoji,
    avatarColor: student.avatarColor,
    knowledgeLevel: student.knowledgeLevel,
    totalPoints: student.totalPoints,
  });
});

// ── Parent: get my children ──────────────────────────────────────────
router.get("/connections/parent/children", requireAuth, async (req, res) => {
  const caller = getUser(req);
  if (caller.role !== "parent") { res.status(403).json({ error: "Forbidden" }); return; }

  const links = await db.select({ studentId: parentChildrenTable.studentId })
    .from(parentChildrenTable)
    .where(eq(parentChildrenTable.parentId, caller.userId));

  if (links.length === 0) { res.json([]); return; }

  const ids = links.map((l) => l.studentId);
  const children = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    username: usersTable.username,
    role: usersTable.role,
    knowledgeLevel: usersTable.knowledgeLevel,
    avatarEmoji: usersTable.avatarEmoji,
    avatarColor: usersTable.avatarColor,
    totalPoints: usersTable.totalPoints,
    inviteCode: usersTable.inviteCode,
  }).from(usersTable).where(inArray(usersTable.id, ids));

  res.json(children);
});

// ── Parent: remove child ─────────────────────────────────────────────
router.delete("/connections/parent/children/:studentId", requireAuth, async (req, res) => {
  const caller = getUser(req);
  if (caller.role !== "parent") { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(parentChildrenTable).where(and(
    eq(parentChildrenTable.parentId, caller.userId),
    eq(parentChildrenTable.studentId, Number(req.params["studentId"])),
  ));
  res.json({ ok: true });
});

// ── Student: send friend request ────────────────────────────────────
router.post("/connections/friends/request", requireAuth, async (req, res) => {
  const caller = getUser(req);
  if (caller.role !== "student") {
    res.status(403).json({ error: "Только ученики могут добавлять друзей" }); return;
  }

  const { code } = req.body as { code: string };
  if (!code) { res.status(400).json({ error: "Код обязателен" }); return; }

  const [friend] = await db.select().from(usersTable)
    .where(eq(usersTable.inviteCode, code.toUpperCase()));

  if (!friend) {
    res.status(404).json({ error: "Ученик с таким кодом не найден" }); return;
  }
  if (friend.role !== "student") {
    res.status(400).json({ error: "Этот пользователь не является учеником" }); return;
  }
  if (friend.id === caller.userId) {
    res.status(400).json({ error: "Нельзя добавить самого себя" }); return;
  }

  // Check if already friends or request pending
  const [existing] = await db.select().from(friendshipsTable).where(
    or(
      and(eq(friendshipsTable.requesterId, caller.userId), eq(friendshipsTable.addresseeId, friend.id)),
      and(eq(friendshipsTable.requesterId, friend.id), eq(friendshipsTable.addresseeId, caller.userId)),
    )
  );
  if (existing) {
    if (existing.status === "accepted") {
      res.status(400).json({ error: "Вы уже друзья" }); return;
    }
    res.status(400).json({ error: "Запрос уже отправлен" }); return;
  }

  await db.insert(friendshipsTable).values({
    requesterId: caller.userId,
    addresseeId: friend.id,
    status: "pending",
  });

  res.status(201).json({
    id: friend.id,
    name: friend.name,
    username: friend.username,
    avatarEmoji: friend.avatarEmoji,
    avatarColor: friend.avatarColor,
    status: "pending",
  });
});

// ── Student: get friends & pending requests ─────────────────────────
router.get("/connections/friends", requireAuth, async (req, res) => {
  const caller = getUser(req);

  const rows = await db.select().from(friendshipsTable).where(
    or(
      eq(friendshipsTable.requesterId, caller.userId),
      eq(friendshipsTable.addresseeId, caller.userId),
    )
  );

  if (rows.length === 0) { res.json([]); return; }

  const otherIds = rows.map((r) =>
    r.requesterId === caller.userId ? r.addresseeId : r.requesterId
  );

  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    username: usersTable.username,
    avatarEmoji: usersTable.avatarEmoji,
    avatarColor: usersTable.avatarColor,
    totalPoints: usersTable.totalPoints,
    knowledgeLevel: usersTable.knowledgeLevel,
  }).from(usersTable).where(inArray(usersTable.id, otherIds));

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const result = rows.map((r) => {
    const otherId = r.requesterId === caller.userId ? r.addresseeId : r.requesterId;
    const isRequester = r.requesterId === caller.userId;
    return {
      friendshipId: r.id,
      user: userMap[otherId],
      status: r.status,
      direction: isRequester ? "sent" : "received",
    };
  });

  res.json(result);
});

// ── Student: accept friend request ───────────────────────────────────
router.patch("/connections/friends/:id/accept", requireAuth, async (req, res) => {
  const caller = getUser(req);
  const id = Number(req.params["id"]);

  const [friendship] = await db.select().from(friendshipsTable).where(eq(friendshipsTable.id, id));
  if (!friendship) { res.status(404).json({ error: "Запрос не найден" }); return; }
  if (friendship.addresseeId !== caller.userId) {
    res.status(403).json({ error: "Нельзя принять чужой запрос" }); return;
  }

  await db.update(friendshipsTable).set({ status: "accepted" }).where(eq(friendshipsTable.id, id));
  res.json({ ok: true });
});

// ── Student: decline / remove friend ────────────────────────────────
router.delete("/connections/friends/:id", requireAuth, async (req, res) => {
  const caller = getUser(req);
  const id = Number(req.params["id"]);

  const [friendship] = await db.select().from(friendshipsTable).where(eq(friendshipsTable.id, id));
  if (!friendship) { res.status(404).json({ error: "Запрос не найден" }); return; }
  if (friendship.requesterId !== caller.userId && friendship.addresseeId !== caller.userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(friendshipsTable).where(eq(friendshipsTable.id, id));
  res.json({ ok: true });
});

// ── Public profile of a friend (accepted only) ───────────────────────
router.get("/connections/friends/:userId/profile", requireAuth, async (req, res) => {
  const caller = getUser(req);
  const targetId = Number(req.params["userId"]);

  // Verify accepted friendship
  const [friendship] = await db.select().from(friendshipsTable).where(
    and(
      or(
        and(eq(friendshipsTable.requesterId, caller.userId), eq(friendshipsTable.addresseeId, targetId)),
        and(eq(friendshipsTable.requesterId, targetId), eq(friendshipsTable.addresseeId, caller.userId)),
      ),
      eq(friendshipsTable.status, "accepted"),
    )
  );

  if (!friendship) {
    res.status(403).json({ error: "Профиль доступен только друзьям" });
    return;
  }

  const [user] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    username: usersTable.username,
    avatarEmoji: usersTable.avatarEmoji,
    avatarColor: usersTable.avatarColor,
    knowledgeLevel: usersTable.knowledgeLevel,
    totalPoints: usersTable.totalPoints,
    totalTimeMinutes: usersTable.totalTimeMinutes,
    bio: usersTable.bio,
    age: usersTable.age,
    role: usersTable.role,
  }).from(usersTable).where(eq(usersTable.id, targetId));

  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }

  const subRows = await db
    .select({ id: submissionsTable.id })
    .from(submissionsTable)
    .where(eq(submissionsTable.studentId, targetId));

  res.json({ ...user, completedAssignments: subRows.length });
});

export default router;
