import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, teacherStudentsTable, parentChildrenTable, friendshipsTable,
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

// ── Teacher: add student ─────────────────────────────────────────────
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
    res.status(400).json({ error: "Этот ученик уже прикреплён к вам" }); return;
  }

  await db.insert(teacherStudentsTable).values({
    teacherId: caller.userId,
    studentId: student.id,
  });

  res.status(201).json({
    id: student.id,
    name: student.name,
    username: student.username,
    avatarEmoji: student.avatarEmoji,
    avatarColor: student.avatarColor,
    knowledgeLevel: student.knowledgeLevel,
  });
});

// ── Teacher: get my students ─────────────────────────────────────────
router.get("/connections/teacher/students", requireAuth, async (req, res) => {
  const caller = getUser(req);
  if (!isTeacher(caller.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const links = await db.select({ studentId: teacherStudentsTable.studentId })
    .from(teacherStudentsTable)
    .where(eq(teacherStudentsTable.teacherId, caller.userId));

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

// ── Teacher: remove student ──────────────────────────────────────────
router.delete("/connections/teacher/students/:studentId", requireAuth, async (req, res) => {
  const caller = getUser(req);
  if (!isTeacher(caller.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(teacherStudentsTable).where(and(
    eq(teacherStudentsTable.teacherId, caller.userId),
    eq(teacherStudentsTable.studentId, Number(req.params["studentId"])),
  ));
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

export default router;
