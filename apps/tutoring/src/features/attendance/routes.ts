import { Router, Response } from "express";
import { AuthenticatedRequest, AttendanceRecordInput } from "../../shared/types/index.js";
import {
  validateBody,
  recordAttendanceSchema,
  scanStudentSchema,
  offlineBatchSyncSchema,
} from "../../shared/middleware/validation.js";
import { attendanceRateLimiter } from "../../shared/middleware/rateLimit.js";
import { getServices } from "../../composition.js";
import { logger } from "../../shared/utils/logger.js";
import { AttendanceService } from "./service.js";

export const attendanceRouter = Router();

function resolveAttendanceService(req: AuthenticatedRequest): AttendanceService {
  const services = getServices(req);
  return services.attendance as AttendanceService;
}

// DEV-SBL.1: Duplicate-Scan Guard
// POST /api/sessions/:id/scan
attendanceRouter.post(
  "/:id/scan",
  attendanceRateLimiter,
  validateBody(scanStudentSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { id: sessionId } = req.params;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveAttendanceService(req);
      const result = await service.scanStudent(tenantId || "", sessionId, req.body);

      if (result.already_recorded) {
        res.status(200).json({
          already_recorded: true,
          message: result.message,
          recorded_at: result.recorded_at,
          attendance: result.attendance,
          student: result.student,
        });
        return;
      }

      res.status(201).json({
        already_recorded: false,
        message: result.message,
        recorded_at: result.recorded_at,
        attendance: result.attendance,
        student: result.student,
      });
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      if (errorMsg === "STUDENT_NOT_FOUND") {
        res.status(404).json({
          error: { code: "NOT_FOUND", message: "Student not found in this tenant" },
        });
        return;
      }
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Scan processing failed", details: errorMsg },
      });
    }
  }
);

// POST /api/sessions/:id/attendance - Batch attendance recording
attendanceRouter.post(
  "/:id/attendance",
  attendanceRateLimiter,
  validateBody(recordAttendanceSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { id: sessionId } = req.params;
    const { records } = req.body as { records: AttendanceRecordInput[] };

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveAttendanceService(req);
      const result = await service.recordBatchAttendance(tenantId || "", sessionId, records);

      res.status(200).json({
        message: result.message,
        count: result.count,
        attendance: result.attendance,
        notification_decisions: result.notification_decisions,
      });
    } catch (err: unknown) {
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to record attendance", details: (err as Error).message },
      });
    }
  }
);

// DEV-OFS.2: Offline-First Batch Sync Endpoint
attendanceRouter.post(
  "/:id/attendance/batch-sync",
  attendanceRateLimiter,
  validateBody(offlineBatchSyncSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { id: sessionId } = req.params;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveAttendanceService(req);
      const result = await service.syncOfflineBatch(tenantId || "", sessionId, req.body.sync_items);
      res.status(200).json(result);
    } catch (err: unknown) {
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Batch sync processing failed", details: (err as Error).message },
      });
    }
  }
);

// DEV-PV.2: WhatsApp Delivery Status
attendanceRouter.get(
  "/:id/delivery-status",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { id: sessionId } = req.params;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveAttendanceService(req);
      const result = await service.getDeliveryStatus(tenantId || "", sessionId);
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch delivery status", details: (err as Error).message },
      });
    }
  }
);

// Concurrency guard to prevent parallel overlapping dispatches for the same session

// DEV-13 (Founder correction) & DEV-36: Explicit batch dispatch of WhatsApp messages
attendanceRouter.post('/:id/send-messages',(_req,res)=>{res.status(410).json({error:{code:'MANUAL_WHATSAPP_ONLY',message:'المتابعة تُرسل من نافذة واتساب. افتح تقرير الطالب وراجع الرسالة قبل إرسالها'}});});

// DEV-ATN.3: Manual resend action for a specific student's message
attendanceRouter.post('/:id/resend/:student_id',(_req,res)=>{res.status(410).json({error:{code:'MANUAL_WHATSAPP_ONLY',message:'افتح رسالة المتابعة في واتساب لإرسالها بنفسك'}});});
