import {
  AttendanceRecordInput,
  AttendanceEvaluation,
  NotificationDecisionType,
} from "../../shared/types/index.js";
import {
  IAttendanceRepository,
  ScanStudentInput,
  ScanStudentResult,
  BatchAttendanceResult,
  OfflineSyncItem,
  OfflineBatchSyncResult,
  SyncItemOutcome,
  DeliveryStatusReport,
  DeliveryStatusItem,
} from "./types.js";

/**
 * Pure helper function to evaluate notification decision logic.
 * Absent or present with teacher comment triggers a notification.
 */
export function evaluateNotificationDecision(
  attended: boolean,
  comment?: string | null
): NotificationDecisionType {
  if (!attended) {
    return "attendance_absent";
  }
  if (comment && comment.trim().length > 0) {
    return "attendance_present_comment";
  }
  return "none";
}

export class AttendanceService {
  constructor(private readonly repository: IAttendanceRepository) {}

  /**
   * DEV-SBL.1: Duplicate-Scan Guard
   * Scans a student for a session. If already scanned, returns already_recorded: true
   * with the original recorded timestamp. Never creates duplicate rows or re-triggers sends.
   */
  async scanStudent(
    tenantId: string,
    sessionId: string,
    input: ScanStudentInput
  ): Promise<
    ScanStudentResult & {
      webhookCandidate?: {
        studentId: string;
        studentName: string;
        parentPhone: string;
        comment: string;
        idempotencyKey: string;
      };
    }
  > {
    const student = await this.repository.findStudent(
      tenantId,
      input.student_id,
      input.student_code
    );

    if (!student) {
      throw new Error("STUDENT_NOT_FOUND");
    }

    const idempotencyKey = `${tenantId}:${student.id}:${sessionId}`;

    // Check duplicate
    const existing = await this.repository.findAttendanceByKey(idempotencyKey);
    if (existing) {
      return {
        already_recorded: true,
        message: `Student already recorded at ${new Date(existing.created_at).toLocaleTimeString()}`,
        recorded_at: existing.created_at,
        attendance: existing,
        student: {
          id: student.id,
          name: student.name,
          student_code: student.student_code,
        },
      };
    }

    // New scan record
    const newRecord = await this.repository.createAttendanceRecord({
      tenant_id: tenantId,
      session_id: sessionId,
      student_id: student.id,
      attended: true,
      comment: input.comment || null,
      homework_status: input.homework_status || null,
      is_makeup: input.is_makeup || false,
      home_group_id: input.home_group_id || null,
      sent: false,
      idempotency_key: idempotencyKey,
    });

    let webhookCandidate: {
      studentId: string;
      studentName: string;
      parentPhone: string;
      comment: string;
      idempotencyKey: string;
    } | undefined;

    if (input.comment && input.comment.trim().length > 0 && student.parent_phone) {
      webhookCandidate = {
        studentId: student.id,
        studentName: student.name,
        parentPhone: student.parent_phone,
        comment: input.comment.trim(),
        idempotencyKey,
      };
    }

    return {
      already_recorded: false,
      message: "Check-in recorded successfully",
      recorded_at: newRecord.created_at,
      attendance: newRecord,
      student: {
        id: student.id,
        name: student.name,
        student_code: student.student_code,
      },
      webhookCandidate,
    };
  }

  /**
   * Records batch attendance and evaluates notification decisions per student.
   */
  async recordBatchAttendance(
    tenantId: string,
    sessionId: string,
    records: AttendanceRecordInput[]
  ): Promise<
    BatchAttendanceResult & {
      notificationCandidates: Array<{
        studentId: string;
        attended: boolean;
        comment?: string | null;
        idempotencyKey: string;
      }>;
    }
  > {
    const attendanceInserts = records.map((r) => {
      const idempotencyKey = `${tenantId}:${r.student_id}:${sessionId}`;
      return {
        tenant_id: tenantId,
        session_id: sessionId,
        student_id: r.student_id,
        attended: r.attended,
        comment: r.comment || null,
        homework_status: r.homework_status || null,
        is_makeup: r.is_makeup || false,
        home_group_id: r.home_group_id || null,
        sent: false,
        idempotency_key: idempotencyKey,
      };
    });

    const savedRows = await this.repository.upsertAttendanceBatch(attendanceInserts);

    const evaluations: AttendanceEvaluation[] = records.map((r) => {
      const idempotencyKey = `${tenantId}:${r.student_id}:${sessionId}`;
      const decision = evaluateNotificationDecision(r.attended, r.comment);

      return {
        student_id: r.student_id,
        attended: r.attended,
        comment: r.comment || null,
        homework_status: r.homework_status || null,
        is_makeup: r.is_makeup || false,
        home_group_id: r.home_group_id || null,
        idempotency_key: idempotencyKey,
        decision,
      };
    });

    const candidates = evaluations
      .filter((e) => e.decision !== "none")
      .map((e) => ({
        studentId: e.student_id,
        attended: e.attended,
        comment: e.comment,
        idempotencyKey: e.idempotency_key,
      }));

    return {
      message: "Attendance recorded successfully",
      count: savedRows.length,
      attendance: savedRows,
      notification_decisions: evaluations,
      notificationCandidates: candidates,
    };
  }

  /**
   * DEV-OFS.2: Offline-First Batch Sync Engine
   * Receives locally-queued writes from offline scanning, applies them idempotently,
   * and returns per-item sync status (synced, already_recorded, or failed).
   */
  async syncOfflineBatch(
    tenantId: string,
    sessionId: string,
    items: OfflineSyncItem[]
  ): Promise<OfflineBatchSyncResult> {
    let syncedCount = 0;
    let alreadyRecordedCount = 0;
    let failedCount = 0;
    const results: SyncItemOutcome[] = [];

    for (const item of items) {
      const expectedKey = `${tenantId}:${item.student_id}:${sessionId}`;
      const idempotencyKey = item.idempotency_key || expectedKey;

      try {
        const existing = await this.repository.findAttendanceByKey(idempotencyKey);
        if (existing) {
          alreadyRecordedCount += 1;
          results.push({
            idempotency_key: idempotencyKey,
            student_id: item.student_id,
            status: "already_recorded",
            recorded_at: existing.created_at,
          });
          continue;
        }

        const inserted = await this.repository.createAttendanceRecord({
          tenant_id: tenantId,
          session_id: sessionId,
          student_id: item.student_id,
          attended: item.attended ?? true,
          comment: item.comment || null,
          homework_status: item.homework_status || null,
          is_makeup: item.is_makeup || false,
          home_group_id: item.home_group_id || null,
          sent: false,
          idempotency_key: idempotencyKey,
        });

        syncedCount += 1;
        results.push({
          idempotency_key: idempotencyKey,
          student_id: item.student_id,
          status: "synced",
          recorded_at: inserted.created_at,
        });
      } catch (err: unknown) {
        failedCount += 1;
        results.push({
          idempotency_key: idempotencyKey,
          student_id: item.student_id,
          status: "failed",
          error: (err as Error).message,
        });
      }
    }

    return {
      total: items.length,
      synced_count: syncedCount,
      already_recorded_count: alreadyRecordedCount,
      failed_count: failedCount,
      results,
    };
  }

  /**
   * DEV-PV.2: WhatsApp Delivery Status & Failure Visibility
   */
  async getDeliveryStatus(tenantId: string, sessionId: string): Promise<DeliveryStatusReport> {
    const attendanceRows = await this.repository.getAttendanceForSession(sessionId);
    const messageLogs = await this.repository.getMessageLogsForTenant(tenantId);

    const logsByStudent = new Map<string, { status: string; error_detail?: string | null; created_at: string }>();
    for (const log of messageLogs) {
      if (log.idempotency_key && log.idempotency_key.includes(`:${sessionId}`)) {
        const parts = log.idempotency_key.split(":");
        if (parts.length >= 3) {
          const studentId = parts[1];
          if (!logsByStudent.has(studentId)) {
            logsByStudent.set(studentId, log);
          }
        }
      }
    }

    const rawRows = attendanceRows as unknown as Array<{
      id: string;
      student_id: string;
      attended: boolean;
      sent?: boolean;
      students?: {
        id?: string;
        name?: string;
        student_code?: string;
        parent_phone?: string;
      } | null;
    }>;

    const deliveryReports: DeliveryStatusItem[] = rawRows.map((row) => {
      const student = row.students;
      const studentId = row.student_id;
      const log = logsByStudent.get(studentId);

      let deliveryStatus = "not_sent";
      let failureReason: string | null = null;

      if (log) {
        deliveryStatus = log.status || "not_sent";
        failureReason = log.error_detail || null;
      } else if (row.sent) {
        deliveryStatus = "sent";
      }

      return {
        student_id: studentId,
        student_name: student?.name || "Unknown",
        student_code: student?.student_code || null,
        parent_phone: student?.parent_phone || null,
        attended: row.attended,
        delivery_status: deliveryStatus,
        failure_reason: failureReason,
        logged_at: log?.created_at || null,
      };
    });

    const failedCount = deliveryReports.filter(
      (r) => r.delivery_status === "failed" || r.delivery_status === "rejected"
    ).length;
    const sentCount = deliveryReports.filter((r) => r.delivery_status === "sent").length;

    return {
      session_id: sessionId,
      total_students: deliveryReports.length,
      sent_count: sentCount,
      failed_count: failedCount,
      deliveries: deliveryReports,
    };
  }
}
