import {changeSavedSchedule,registerSavedScheduleRoutes} from './schedule.js';
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
registerSavedScheduleRoutes(sessionsRouter);

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

// Saved schedule changes never dispatch notifications automatically.
sessionsRouter.post('/:id/cancel',validateBody(cancelSessionSchema),async(req:AuthenticatedRequest,res)=>{
 await changeSavedSchedule(req,res,'cancel',{...req.body,id:req.params.id,is_group:false});
});

// Saved schedule changes never dispatch notifications automatically.
sessionsRouter.post('/:id/reschedule',validateBody(rescheduleSessionSchema),async(req:AuthenticatedRequest,res)=>{
 await changeSavedSchedule(req,res,'reschedule',{...req.body,id:req.params.id,is_group:false});
});

// An extra session is saved atomically with its selected time.
sessionsRouter.post('/extra',validateBody(extraSessionSchema),async(req:AuthenticatedRequest,res)=>{
 await changeSavedSchedule(req,res,'extra',req.body,201);
});

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

// GET /api/sessions/actual-earnings - Monthly actual realized earnings from completed sessions
sessionsRouter.get(
  "/actual-earnings",
  requireFinancialAccess,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const now = new Date();
      const month = req.query.month ? parseInt(String(req.query.month), 10) : now.getMonth() + 1;
      const year = req.query.year ? parseInt(String(req.query.year), 10) : now.getFullYear();

      const service = resolveSessionsService(req);
      const result = await service.getMonthlyActualEarnings(tenantId || "", month, year);
      res.status(200).json(result);
    } catch (err: unknown) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to calculate actual earnings",
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
    const { recipient_phone, recipient_type = "teacher", send_via_whatsapp = false } = req.body;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    if(send_via_whatsapp){res.status(409).json({error:{code:'MANUAL_WHATSAPP_ONLY',message:'شارك الإيصال من نافذة واتساب بعد مراجعته؛ لا يُرسل تلقائيًا من المنصة'}});return;}

    try {
      const service = resolveSessionsService(req);
      const result = await service.generateReceipt(tenantId || "", sessionId, {
        recipient_phone,
        recipient_type,
        send_via_whatsapp: false,
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

// Retired unreviewed bulk-send path. Teachers use the explicit announcement
// preview/consent/allowance workflow, or open WhatsApp manually.
sessionsRouter.post('/:id/notify-students',(_req,res)=>{res.status(410).json({error:{code:'ANNOUNCEMENT_REVIEW_REQUIRED',message:'افتح مسودة الرسائل والإعلانات لمراجعة النص واختيار المستلمين قبل الإرسال'}});});

// Mount attendance router sub-routes (/scan, /attendance, /attendance/batch-sync, /delivery-status)
sessionsRouter.use("/", attendanceRouter);

