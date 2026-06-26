import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import assignmentsRouter from "./assignments";
import submissionsRouter from "./submissions";
import voiceChatRouter from "./voiceChat";
import timeTrackingRouter from "./timeTracking";
import leaderboardRouter from "./leaderboard";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(assignmentsRouter);
router.use(submissionsRouter);
router.use(voiceChatRouter);
router.use(timeTrackingRouter);
router.use(leaderboardRouter);
router.use(uploadRouter);

export default router;
