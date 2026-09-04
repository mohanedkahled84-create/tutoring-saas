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

// DEV-13 (Founder correction) & DEV-36: Explicit batch dispatch of WhatsApp messages
attendanceRouter.post(
  "/:id/send-messages",
  attendanceRateLimiter,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { id: sessionId } = req.params;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const services = getServices(req);
      const attendanceService = services.attendance as AttendanceService;
      const whatsAppService = services.whatsapp;

      const result = await attendanceService.dispatchSessionMessages(
        tenantId || "",
        sessionId,
        whatsAppService
      );

      res.status(200).json(result);
    } catch (err: unknown) {
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to dispatch session messages", details: (err as Error).message },
      });
    }
  }
);

// DEV-ATN.3: Manual resend action for a specific student's message
attendanceRouter.post(
  "/:id/resend/:student_id",
  attendanceRateLimiter,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { id: sessionId, student_id: studentId } = req.params;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const services = getServices(req);
      const attendanceService = services.attendance as AttendanceService;
      const whatsAppService = services.whatsapp;

      const result = await attendanceService.resendStudentMessage(
        tenantId || "",
        sessionId,
        studentId,
        whatsAppService
      );

      res.status(200).json(result);
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      if (errorMsg === "STUDENT_NOT_FOUND" || errorMsg === "ATTENDANCE_NOT_FOUND") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: errorMsg } });
        return;
      }
      if (errorMsg === "MISSING_PARENT_PHONE") {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: "Student has no parent phone registered" } });
        return;
      }
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to resend message", details: errorMsg },
      });
    }
  }
);
