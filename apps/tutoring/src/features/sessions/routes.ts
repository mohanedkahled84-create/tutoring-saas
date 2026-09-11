import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import {
  validateBody,
  createSessionSchema,
  cancelSessionSchema,
  rescheduleSessionSchema,
  extraSessionSchema,
  quizScoreSchema,
} from "../../shared/middleware/validation.js";
import { requireFinancialAccess } from "../../shared/middleware/auth.js";
import { requireFeatureFlag } from "../../shared/middleware/featureFlags.js";
import { getServices } from "../../composition.js";
import { SessionsService } from "./service.js";
import { SessionModel } from "./types.js";
import { attendanceRouter } from "../attendance/routes.js";

export const sessionsRouter = Router();

function resolveSessionsService(req: AuthenticatedRequest): SessionsService {
  const services = getServices(req);
  return services.sessions as SessionsService;
}

// POST /api/sessions - Create a new session
sessionsRouter.post(
  "/",
  validateBody(createSessionSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { group_id, session_number, session_date } = req.body;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveSessionsService(req);
      const session = await service.createSession(tenantId || "", {
        group_id,
        session_number,
        session_date,
      });

      res.status(201).json({ session });
    } catch (err: unknown) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: (err as Error).message },
      });
    }
  }
);

// POST /api/sessions/:id/end - End session and finalize attendance
sessionsRouter.post("/:id/end", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id: sessionId } = req.params;

  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const service = resolveSessionsService(req);
    const result = await service.endSession(tenantId || "", sessionId);
    res.status(200).json(result);
  } catch (err: unknown) {
    const errorMsg = (err as Error).message;
    if (errorMsg === "SESSION_NOT_FOUND") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
      return;
    }
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to end session", details: errorMsg },
    });
  }
});

function requireTeacherOrAdmin(req: AuthenticatedRequest, res: Response): boolean {
  if (req.user?.role === "assistant") {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Assistants are not permitted to manage session scheduling",
      },
    });
    return false;
  }
  return true;
}

// POST /api/sessions/:id/cancel - Cancel a session and notify parents
sessionsRouter.post(
  "/:id/cancel",
  validateBody(cancelSessionSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!requireTeacherOrAdmin(req, res)) return;

    const tenantId = req.user?.tenant_id;
    const { id: sessionId } = req.params;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveSessionsService(req);
      const result = await service.cancelSession(tenantId || "", sessionId, req.body);
      res.status(200).json(result);
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      if (errorMsg === "SESSION_NOT_FOUND") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
        return;
      }
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to cancel session", details: errorMsg },
      });
    }
  }
);

// POST /api/sessions/:id/reschedule - Reschedule a session and notify parents
sessionsRouter.post(
  "/:id/reschedule",
  validateBody(rescheduleSessionSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!requireTeacherOrAdmin(req, res)) return;

    const tenantId = req.user?.tenant_id;
    const { id: sessionId } = req.params;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveSessionsService(req);
      const result = await service.rescheduleSession(tenantId || "", sessionId, req.body);
      res.status(200).json(result);
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      if (errorMsg === "SESSION_NOT_FOUND") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
        return;
      }
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to reschedule session", details: errorMsg },
      });
    }
  }
);

// POST /api/sessions/extra - Create an extra session and notify parents
sessionsRouter.post(
  "/extra",
  validateBody(extraSessionSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!requireTeacherOrAdmin(req, res)) return;

    const tenantId = req.user?.tenant_id;
    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveSessionsService(req);
      const result = await service.createExtraSession(tenantId || "", req.body);
      res.status(201).json(result);
    } catch (err: unknown) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: (err as Error).message },
      });
    }
  }
);

// DEV-56: Teacher Calendar Range Query (Daily / Weekly / Monthly)
sessionsRouter.get(
  "/calendar",
  requireFeatureFlag("teacherCalendar"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    const { from, to } = req.query;
    if (!from || !to || typeof from !== "string" || typeof to !== "string") {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Query parameters 'from' and 'to' (format YYYY-MM-DD) are required",
        },
      });
      return;
    }

    try {
      const service = resolveSessionsService(req);
      const sessions = await service.getCalendarSessions(tenantId || "", from, to);
      res.json({ sessions, count: sessions.length });
    } catch (err: unknown) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch calendar sessions",
          details: (err as Error).message,
        },
      });
    }
  }
);

// GET /api/sessions - List sessions for tenant
sessionsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const service = resolveSessionsService(req);
    const from = (req.query.from as string) || "2020-01-01";
    const to = (req.query.to as string) || "2030-12-31";
    let sessions = await service.getCalendarSessions(tenantId || "", from, to);
    if (req.query.status) {
      sessions = sessions.filter((s: SessionModel) => s.status === req.query.status);
    }
    if (req.query.group_id) {
      sessions = sessions.filter((s: SessionModel) => s.group_id === req.query.group_id);
    }
    res.json({ sessions, count: sessions.length });
  } catch (err: unknown) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to list sessions", details: (err as Error).message },
    });
  }
});

// GET /api/sessions/:id - Retrieve session with attendance and quiz scores
sessionsRouter.get("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const service = resolveSessionsService(req);
    const details = await service.getSessionDetails(id);

    res.json(details);
  } catch (err: unknown) {
    const errorMsg = (err as Error).message;
    if (errorMsg === "SESSION_NOT_FOUND") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
      return;
    }
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to retrieve session", details: errorMsg },
    });
  }
});

// DEV-SBL.2: Incremental Quiz Score Auto-Save
sessionsRouter.put(
  "/:id/quiz-scores/:student_id",
  validateBody(quizScoreSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { id: sessionId, student_id: studentId } = req.params;
    const { score, max_score } = req.body;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveSessionsService(req);
      const savedScore = await service.saveQuizScore(
        tenantId || "",
        sessionId,
        studentId,
        score,
        max_score
      );

      res.status(200).json({
        message: "Quiz score saved",
        quiz_score: savedScore,
      });
    } catch (err: unknown) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: (err as Error).message },
      });
    }
  }
);

// GET /api/sessions/:id/quiz-scores - Retrieve all quiz scores for a session
sessionsRouter.get(
  "/:id/quiz-scores",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id: sessionId } = req.params;

    try {
      const service = resolveSessionsService(req);
      const scores = await service.listQuizScores(sessionId);

      res.json({ quiz_scores: scores });
    } catch (err: unknown) {
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to list quiz scores", details: (err as Error).message },
      });
    }
  }
);

// DEV-SBL.3 & DEV-SE.1: Session Financial Summary
sessionsRouter.get(
  "/:id/financial-summary",
  requireFinancialAccess,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id: sessionId } = req.params;

    try {
      const service = resolveSessionsService(req);
      const summary = await service.getFinancialSummary(sessionId);

      res.json(summary);
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      if (errorMsg === "SESSION_NOT_FOUND") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
        return;
      }
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Financial calculation failed", details: errorMsg },
      });
    }
  }
);

// DEV-SR.1: Session WhatsApp Receipt Generator
sessionsRouter.post(
  "/:id/receipt",
  requireFinancialAccess,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { id: sessionId } = req.params;
    const { recipient_phone, recipient_type = "teacher", send_via_whatsapp = true } = req.body;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveSessionsService(req);
      const result = await service.generateReceipt(tenantId || "", sessionId, {
        recipient_phone,
        recipient_type,
        send_via_whatsapp,
      });

      res.status(200).json(result);
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      if (errorMsg === "SESSION_NOT_FOUND") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
        return;
      }
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to generate receipt", details: errorMsg },
      });
    }
  }
);

// DEV-NOTIF.1: POST /api/sessions/:id/notify-students - Dispatch WhatsApp alerts directly to students
sessionsRouter.post(
  "/:id/notify-students",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const { id: sessionId } = req.params;
    const {
      event_type,
      group_id,
      group_name,
      date,
      time,
      reason,
      topic,
      teacher_id,
      teacher_name,
      pacing_delay_ms,
    } = req.body;

    try {
      const services = getServices(req);
      const whatsAppService = services.whatsapp;
      const studentsService = services.students;

      const targetGroupId =
        group_id ||
        (sessionId.startsWith("group-") ? sessionId.replace("group-", "") : undefined);
      const students = await studentsService.listStudents(tenantId, undefined, targetGroupId);

      const items = students
        .filter((s) => s.student_phone || s.parent_phone)
        .map((s) => ({
          recipient_id: s.id,
          recipient_name: s.name,
          phone: s.student_phone || s.parent_phone || "",
        }));

      const resolvedTeacherId =
        teacher_id ||
        req.user?.teacher_id ||
        (req.user?.role === "teacher" ? req.user?.id : "default");

      const result = await whatsAppService.batchSendCustomNotification(
        tenantId,
        items,
        {
          event_type: event_type || "general",
          group_name,
          date,
          time,
          reason,
          topic,
          teacher_id: resolvedTeacherId,
          teacher_name,
          pacingDelayMs: pacing_delay_ms,
        }
      );

      res.status(200).json(result);
    } catch (err: unknown) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to dispatch student notifications",
          details: (err as Error).message,
        },
      });
    }
  }
);

// Mount attendance router sub-routes (/scan, /attendance, /attendance/batch-sync, /delivery-status)
sessionsRouter.use("/", attendanceRouter);

