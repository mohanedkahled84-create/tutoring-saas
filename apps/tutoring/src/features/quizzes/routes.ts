import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServices } from "../../composition.js";

export const quizzesRouter = Router();

// GET /api/quizzes - Fetch quizzes and all student scores for a given group
quizzesRouter.get(
  "/",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const groupId = (req.query.group_id as string) || "";

    try {
      const services = getServices(req);
      const quizzesService = services.quizzes;

      const data = await quizzesService.listGroupQuizzesData(tenantId, groupId);
      res.status(200).json({
        success: true,
        ...data,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch quizzes";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// POST /api/quizzes - Create or update a single quiz definition
quizzesRouter.post(
  "/",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const { id, group_id, quiz_number, title, max_score, quiz_date, is_skipped } = req.body;

    if (!group_id || quiz_number === undefined) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "group_id and quiz_number are required" },
      });
      return;
    }

    try {
      const services = getServices(req);
      const quiz = await services.quizzes.upsertQuiz(tenantId, {
        id,
        group_id,
        quiz_number: Number(quiz_number),
        title: title || `كويز ${quiz_number}`,
        max_score: max_score !== undefined ? Number(max_score) : 10,
        quiz_date,
        is_skipped: Boolean(is_skipped),
      });

      res.status(200).json({ success: true, quiz });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upsert quiz";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-QUIZ.2: POST /api/quizzes/dispatch-scores - Batch dispatch quiz scores with Ultra Anti-Ban pacing & variations
quizzesRouter.post(
  "/dispatch-scores",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const {
      group_id,
      quiz_number,
      quiz_title,
      max_score,
      teacher_id,
      teacher_name,
      students,
      pacing_delay_ms,
      daily_cap,
    } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "students array must not be empty" },
      });
      return;
    }

    try {
      const services = getServices(req);
      const whatsAppService = services.whatsapp;
      const quizzesService = services.quizzes;

      const resolvedTeacherId =
        teacher_id ||
        req.user?.teacher_id ||
        (req.user?.role === "teacher" ? req.user?.id : "default");

      const target = (req.body.target === "parents" || req.body.target === "students" || req.body.target === "both")
        ? req.body.target
        : "both";

      const result = await whatsAppService.batchSendQuizScores(
        tenantId,
        students.map((s: {
          student_id?: string;
          id?: string;
          student_name?: string;
          name?: string;
          parent_phone?: string;
          student_phone?: string;
          phone?: string;
          score: number | string;
          note?: string;
        }) => ({
          student_id: s.student_id || s.id || "",
          student_name: s.student_name || s.name || "الطالب",
          parent_phone: s.parent_phone || "",
          student_phone: s.student_phone || s.phone || "",
          score: Number(s.score),
          note: s.note,
        })),
        {
          quiz_title: quiz_title || "الكويز",
          max_score: max_score ? Number(max_score) : 10,
          teacher_id: resolvedTeacherId,
          teacher_name,
          pacingDelayMs: pacing_delay_ms,
          dailyCap: daily_cap,
          target,
        }
      );

      // Update delivery statuses in quiz_scores table if group_id and quiz_number provided
      if (group_id && quiz_number !== undefined) {
        for (const r of result.results) {
          await quizzesService.updateDeliveryStatus(
            tenantId,
            group_id,
            Number(quiz_number),
            r.student_id,
            r.status === "sent" ? "sent" : "failed"
          ).catch(() => {});
        }
      }

      res.status(200).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to dispatch quiz scores";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-QUIZ.3: POST /api/quizzes/scores - Save quiz scores to repository
quizzesRouter.post(
  "/scores",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const { session_id, group_id, quiz_number, quiz_title, max_score, scores, notes } = req.body;

    if (!scores || typeof scores !== "object") {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "scores object is required" },
      });
      return;
    }

    const qNum = quiz_number !== undefined ? Number(quiz_number) : 1;
    const resolvedGroupId = group_id || "default-group";

    try {
      const services = getServices(req);
      const quizzesService = services.quizzes;

      // 1. Save to Quizzes Service (persisting to quizzes and quiz_scores with group_id)
      const { savedCount } = await quizzesService.saveScores(tenantId, {
        group_id: resolvedGroupId,
        quiz_number: qNum,
        quiz_title: quiz_title || `كويز ${qNum}`,
        max_score: max_score ? Number(max_score) : 10,
        scores,
        notes,
      });

      // 2. Backward compatibility with session-based tests if session_id is a valid UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session_id || "");
      if (isUUID) {
        const sessionsService = services.sessions;
        for (const [studentId, scoreVal] of Object.entries(scores)) {
          if (scoreVal !== undefined && scoreVal !== null && scoreVal !== "") {
            await sessionsService.saveQuizScore(
              tenantId,
              session_id,
              studentId,
              Number(scoreVal),
              max_score ? Number(max_score) : 10
            ).catch(() => {});
          }
        }
      }

      res.status(200).json({
        success: true,
        message: "Quiz scores saved successfully",
        count: savedCount,
      });
    } catch (err: unknown) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to save quiz scores",
          details: (err as Error).message,
        },
      });
    }
  }
);
