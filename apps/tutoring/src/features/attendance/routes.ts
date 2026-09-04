import { Router, Response } from "express";
import { AuthenticatedRequest, AttendanceRecordInput } from "../../types/index.js";
import {
  validateBody,
  recordAttendanceSchema,
  scanStudentSchema,
  offlineBatchSyncSchema,
} from "../../middleware/validation.js";
import { attendanceRateLimiter } from "../../middleware/rateLimit.js";
import { getServices } from "../../composition.js";
import { AttendanceService } from "./service.js";
import { dispatchAttendanceWebhook } from "../../services/webhookDispatcher.js";

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

      // Trigger n8n attendance webhook if comment is present and student parent phone is available
      if (result.webhookCandidate) {
        dispatchAttendanceWebhook({
          tenant_id: tenantId!,
          event_type: "attendance_recorded",
          student_id: result.webhookCandidate.studentId,
          student_name: result.webhookCandidate.studentName,
          session_id: sessionId,
          attended: true,
          comment: result.webhookCandidate.comment,
          parent_phone: result.webhookCandidate.parentPhone,
          idempotency_key: result.webhookCandidate.idempotencyKey,
        }).catch(() => {});
      }

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

      // Async webhook dispatch for eligible notifications
      if (result.notificationCandidates.length > 0) {
        (async () => {
          const studentIds = result.notificationCandidates.map((c) => c.studentId);
          const studentRows = await (service as unknown as { repository: { getStudentsByIds: (t: string, ids: string[]) => Promise<Array<{ id: string; name: string; parent_phone: string }>> } }).repository.getStudentsByIds(tenantId || "", studentIds);
          const studentMap = new Map(studentRows.map((s) => [s.id, s]));

          for (const item of result.notificationCandidates) {
            const s = studentMap.get(item.studentId);
            if (s && s.parent_phone) {
              dispatchAttendanceWebhook({
                tenant_id: tenantId!,
                event_type: "attendance_recorded",
                student_id: item.studentId,
                student_name: s.name,
                session_id: sessionId,
                attended: item.attended,
                comment: item.comment || null,
                parent_phone: s.parent_phone,
                idempotency_key: item.idempotencyKey,
              }).catch(() => {});
            }
          }
        })().catch(() => {});
      }

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
