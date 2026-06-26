import { Router } from "express";
import { db } from "@workspace/db";
import { assignmentsTable, questionsTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAuth, getUser, requireRole } from "../lib/auth";

const router = Router();

router.get("/assignments", requireAuth, async (req, res) => {
  const { type, ageMin, ageMax } = req.query;
  const user = getUser(req);

  let query = db.select().from(assignmentsTable);
  const conditions: any[] = [];

  if (type) conditions.push(eq(assignmentsTable.type, type as any));
  if (ageMin) conditions.push(lte(assignmentsTable.ageMin, Number(ageMin)));
  if (ageMax) conditions.push(gte(assignmentsTable.ageMax, Number(ageMax)));

  const assignments = conditions.length > 0
    ? await db.select().from(assignmentsTable).where(and(...conditions))
    : await db.select().from(assignmentsTable);

  res.json(assignments);
});

router.post("/assignments", requireAuth, requireRole("admin"), async (req, res) => {
  const { title, description, type, ageMin, ageMax, points, mediaUrl, content, questions } = req.body;

  const [assignment] = await db.insert(assignmentsTable).values({
    title,
    description,
    type,
    ageMin: ageMin || 5,
    ageMax: ageMax || 18,
    points: points || 10,
    mediaUrl,
    content,
  }).returning();

  if (questions && questions.length > 0) {
    await db.insert(questionsTable).values(
      questions.map((q: any, i: number) => ({
        assignmentId: assignment.id,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        orderIndex: q.orderIndex ?? i,
      }))
    );
  }

  res.status(201).json(assignment);
});

router.get("/assignments/:id", requireAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  const user = getUser(req);

  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, id));
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }

  const questions = await db.select().from(questionsTable)
    .where(eq(questionsTable.assignmentId, id))
    .orderBy(questionsTable.orderIndex);

  const isAdmin = user.role === "admin";

  res.json({
    ...assignment,
    questions: questions.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options,
      correctAnswer: isAdmin ? q.correctAnswer : null,
      orderIndex: q.orderIndex,
    })),
    content: assignment.content,
  });
});

router.patch("/assignments/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  const { title, description, ageMin, ageMax, points, mediaUrl, content } = req.body;

  const [updated] = await db.update(assignmentsTable)
    .set({ title, description, ageMin, ageMax, points, mediaUrl, content, updatedAt: new Date() })
    .where(eq(assignmentsTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/assignments/:id", requireAuth, requireRole("admin"), async (req, res) => {
  await db.delete(assignmentsTable).where(eq(assignmentsTable.id, Number(req.params["id"])));
  res.status(204).send();
});

export default router;
