import { Router } from "express";
import { db } from "@workspace/db";
import {
  submissionsTable, submissionAnswersTable,
  questionsTable, assignmentsTable, usersTable
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

router.post("/assignments/:id/submit", requireAuth, async (req, res) => {
  const assignmentId = Number(req.params["id"]);
  const user = getUser(req);
  const { answers, recordingUrl } = req.body;

  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId));
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }

  const questions = await db.select().from(questionsTable)
    .where(eq(questionsTable.assignmentId, assignmentId));

  let correctCount = 0;
  const results: any[] = [];

  for (const answer of (answers ?? [])) {
    const question = questions.find(q => q.id === answer.questionId);
    if (!question) continue;
    const isCorrect = (question.correctAnswer ?? "").toLowerCase().trim() === (answer.answer ?? "").toLowerCase().trim();
    if (isCorrect) correctCount++;
    results.push({
      questionId: question.id,
      isCorrect,
      studentAnswer: answer.answer,
      correctAnswer: question.correctAnswer,
      questionText: question.text,
    });
  }

  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const pointsEarned = Math.round(assignment.points * (correctCount / Math.max(totalQuestions, 1)));

  const [submission] = await db.insert(submissionsTable).values({
    studentId: user.userId,
    assignmentId,
    score,
    correctCount,
    totalQuestions,
    pointsEarned,
    recordingUrl: recordingUrl || null,
  }).returning();

  if (results.length > 0) {
    await db.insert(submissionAnswersTable).values(
      results.map(r => ({
        submissionId: submission.id,
        questionId: r.questionId,
        studentAnswer: r.studentAnswer,
        correctAnswer: r.correctAnswer,
        isCorrect: r.isCorrect,
        questionText: r.questionText,
      }))
    );
  }

  // Award points to user
  if (pointsEarned > 0) {
    await db.update(usersTable)
      .set({ totalPoints: db.$with("pts").as(db.select({ v: usersTable.totalPoints }).from(usersTable)) as any })
      .where(eq(usersTable.id, user.userId));
    // Simpler approach: get current points and add
    const [userData] = await db.select({ totalPoints: usersTable.totalPoints }).from(usersTable).where(eq(usersTable.id, user.userId));
    await db.update(usersTable)
      .set({ totalPoints: (userData?.totalPoints || 0) + pointsEarned })
      .where(eq(usersTable.id, user.userId));
  }

  res.json({
    submissionId: submission.id,
    score,
    totalQuestions,
    correctCount,
    pointsEarned,
    results: results.map(r => ({
      questionId: r.questionId,
      isCorrect: r.isCorrect,
      studentAnswer: r.studentAnswer,
      correctAnswer: r.correctAnswer,
    })),
  });
});

router.get("/assignments/:id/submissions", requireAuth, async (req, res) => {
  const assignmentId = Number(req.params["id"]);

  const submissions = await db.select({
    id: submissionsTable.id,
    studentId: submissionsTable.studentId,
    studentName: usersTable.name,
    assignmentId: submissionsTable.assignmentId,
    assignmentTitle: assignmentsTable.title,
    score: submissionsTable.score,
    correctCount: submissionsTable.correctCount,
    totalQuestions: submissionsTable.totalQuestions,
    pointsEarned: submissionsTable.pointsEarned,
    recordingUrl: submissionsTable.recordingUrl,
    submittedAt: submissionsTable.submittedAt,
  }).from(submissionsTable)
    .leftJoin(usersTable, eq(submissionsTable.studentId, usersTable.id))
    .leftJoin(assignmentsTable, eq(submissionsTable.assignmentId, assignmentsTable.id))
    .where(eq(submissionsTable.assignmentId, assignmentId));

  const withAnswers = await Promise.all(submissions.map(async (sub) => {
    const answers = await db.select().from(submissionAnswersTable)
      .where(eq(submissionAnswersTable.submissionId, sub.id));
    return {
      ...sub,
      answers: answers.map(a => ({
        questionId: a.questionId,
        isCorrect: a.isCorrect,
        studentAnswer: a.studentAnswer,
        correctAnswer: a.correctAnswer,
      })),
    };
  }));

  res.json(withAnswers);
});

router.get("/students/:id/submissions", requireAuth, async (req, res) => {
  const studentId = Number(req.params["id"]);

  const submissions = await db.select({
    id: submissionsTable.id,
    studentId: submissionsTable.studentId,
    studentName: usersTable.name,
    assignmentId: submissionsTable.assignmentId,
    assignmentTitle: assignmentsTable.title,
    score: submissionsTable.score,
    correctCount: submissionsTable.correctCount,
    totalQuestions: submissionsTable.totalQuestions,
    pointsEarned: submissionsTable.pointsEarned,
    recordingUrl: submissionsTable.recordingUrl,
    submittedAt: submissionsTable.submittedAt,
  }).from(submissionsTable)
    .leftJoin(usersTable, eq(submissionsTable.studentId, usersTable.id))
    .leftJoin(assignmentsTable, eq(submissionsTable.assignmentId, assignmentsTable.id))
    .where(eq(submissionsTable.studentId, studentId));

  const withAnswers = await Promise.all(submissions.map(async (sub) => {
    const answers = await db.select().from(submissionAnswersTable)
      .where(eq(submissionAnswersTable.submissionId, sub.id));
    return {
      ...sub,
      answers: answers.map(a => ({
        questionId: a.questionId,
        isCorrect: a.isCorrect,
        studentAnswer: a.studentAnswer,
        correctAnswer: a.correctAnswer,
      })),
    };
  }));

  res.json(withAnswers);
});

router.get("/students/:id/errors", requireAuth, async (req, res) => {
  const studentId = Number(req.params["id"]);

  const errors = await db.select({
    assignmentId: assignmentsTable.id,
    assignmentTitle: assignmentsTable.title,
    questionText: submissionAnswersTable.questionText,
    studentAnswer: submissionAnswersTable.studentAnswer,
    correctAnswer: submissionAnswersTable.correctAnswer,
    occurredAt: submissionsTable.submittedAt,
  }).from(submissionAnswersTable)
    .leftJoin(submissionsTable, eq(submissionAnswersTable.submissionId, submissionsTable.id))
    .leftJoin(assignmentsTable, eq(submissionsTable.assignmentId, assignmentsTable.id))
    .where(and(
      eq(submissionsTable.studentId, studentId),
      eq(submissionAnswersTable.isCorrect, false)
    ));

  res.json(errors);
});

export default router;
