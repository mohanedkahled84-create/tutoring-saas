import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServices } from "../../composition.js";

export const quizzesRouter = Router();

// DEV-QUIZ.2: POST /api/quizzes/dispatch-scores - Batch dispatch quiz scores with anti-ban pacing & variations
quizzesRouter.post(
  "/dispatch-scores",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const {
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
      const whatsAppService = getServices(req).whatsapp;
      const resolvedTeacherId =
        teacher_id ||
        req.user?.teacher_id ||
        (req.user?.role === "teacher" ? req.user?.id : "default");

      const result = await whatsAppService.batchSendQuizScores(
        tenantId,
        students.map((s: {
          student_id?: string;
          id?: string;
          student_name?: string;
          name?: string;
          parent_phone?: string;
          score: number | string;
          note?: string;
        }) => ({
          student_id: s.student_id || s.id || "",
          student_name: s.student_name || s.name || "الطالب",
          parent_phone: s.parent_phone || "",
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
        }
      );

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
    const { session_id, quiz_number, max_score, scores } = req.body;

    if (!scores || typeof scores !== "object") {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "scores object is required" },
      });
      return;
    }

    try {
      const services = getServices(req);
      const sessionsService = services.sessions;
      const targetSessionId = session_id || `quiz-session-${quiz_number || 1}`;

      const savedRecords = [];
      for (const [studentId, scoreVal] of Object.entries(scores)) {
        if (scoreVal !== undefined && scoreVal !== null && scoreVal !== "") {
          const saved = await sessionsService.saveQuizScore(
            tenantId,
            targetSessionId,
            studentId,
            Number(scoreVal),
            max_score ? Number(max_score) : 10
          );
          savedRecords.push(saved);
        }
      }

      res.status(200).json({
        success: true,
        message: "Quiz scores saved successfully",
        count: savedRecords.length,
        records: savedRecords,
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

