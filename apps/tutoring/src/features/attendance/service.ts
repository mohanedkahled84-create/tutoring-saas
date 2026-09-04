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
  IWhatsAppBatchDispatcher,
  DispatchSessionMessagesResult,
  ResendMessageResult,
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

  /**
   * DEV-13 (Founder correction) & DEV-36:
   * Explicitly dispatches batch WhatsApp notifications for an ended session.
   * Gathers absent students and present students with teacher comments.
   * Runs through WhatsAppNotificationsService batchSendWithPacing.
   */
  async dispatchSessionMessages(
    tenantId: string,
    sessionId: string,
    whatsAppDispatcher: IWhatsAppBatchDispatcher,
    options?: { pacingDelayMs?: number; dailyCap?: number }
  ): Promise<DispatchSessionMessagesResult> {
    const attendanceRecords = await this.repository.getAttendanceWithStudentsForSession(sessionId);

    // Filter to candidates needing notifications
    const itemsToSend: Array<{
      attendanceId: string;
      student_id: string;
      student_name: string;
      parent_phone: string;
      session_id: string;
      attended: boolean;
      comment?: string | null;
      idempotency_key: string;
      decision: string;
    }> = [];

    const preFilteredResults: DispatchSessionMessagesResult["results"] = [];

    for (const record of attendanceRecords) {
      const student = record.students;
      const studentName = student?.name || "طالب";
      const parentPhone = student?.parent_phone || "";
      const decision = evaluateNotificationDecision(record.attended, record.comment);

      if (decision === "none") {
        preFilteredResults.push({
          student_id: record.student_id,
          student_name: studentName,
          phone: parentPhone,
          decision,
          status: "skipped",
          reason: "Present student without teacher comment",
        });
        continue;
      }

      if (record.sent) {
        preFilteredResults.push({
          student_id: record.student_id,
          student_name: studentName,
          phone: parentPhone,
          decision,
          status: "already_sent",
          reason: "Message was already marked sent",
        });
        continue;
      }

      if (!parentPhone || parentPhone.trim().length < 9) {
        preFilteredResults.push({
          student_id: record.student_id,
          student_name: studentName,
          phone: parentPhone,
          decision,
          status: "failed",
          reason: "Missing or invalid parent phone number",
        });
        continue;
      }

      itemsToSend.push({
        attendanceId: record.id,
        student_id: record.student_id,
        student_name: studentName,
        parent_phone: parentPhone,
        session_id: sessionId,
        attended: record.attended,
        comment: record.comment,
        idempotency_key: record.idempotency_key,
        decision,
      });
    }

    // Call WhatsApp batch pacing engine
    const batchResult = await whatsAppDispatcher.batchSendWithPacing(
      tenantId,
      itemsToSend,
      options
    );

    // Update attendance records in DB
    for (let i = 0; i < itemsToSend.length; i++) {
      const item = itemsToSend[i];
      const sendRes = batchResult.results[i];
      if (sendRes && sendRes.status === "sent") {
        await this.repository.updateAttendanceStatus(item.attendanceId, {
          sent: true,
          wa_status: "sent",
        });
        preFilteredResults.push({
          student_id: item.student_id,
          student_name: item.student_name,
          phone: item.parent_phone,
          decision: item.decision,
          status: "dispatched",
        });
      } else {
        await this.repository.updateAttendanceStatus(item.attendanceId, {
          sent: false,
          wa_status: sendRes?.status === "skipped_daily_cap" ? "queued" : "failed",
        });
        preFilteredResults.push({
          student_id: item.student_id,
          student_name: item.student_name,
          phone: item.parent_phone,
          decision: item.decision,
          status: "failed",
          reason: sendRes?.error || "Send failed",
        });
      }
    }

    return {
      session_id: sessionId,
      total_students: attendanceRecords.length,
      eligible_count: itemsToSend.length,
      dispatched_count: batchResult.sent_count,
      skipped_count: preFilteredResults.filter((r) => r.status === "skipped" || r.status === "already_sent").length,
      results: preFilteredResults,
    };
  }

  /**
   * DEV-ATN.3: Manual Resend Action
   * Teacher manually resends a failed or needs_review notification for a single student.
   * Generates a safe resend idempotency key and dispatches webhook.
   */
  async resendStudentMessage(
    tenantId: string,
    sessionId: string,
    studentId: string,
    whatsAppDispatcher: IWhatsAppBatchDispatcher
  ): Promise<ResendMessageResult> {
    const student = await this.repository.findStudent(tenantId, studentId);
    if (!student) {
      throw new Error("STUDENT_NOT_FOUND");
    }
    if (!student.parent_phone) {
      throw new Error("MISSING_PARENT_PHONE");
    }

    const attendanceRecords = await this.repository.getAttendanceForSession(sessionId);
    const attRecord = attendanceRecords.find((a) => a.student_id === studentId);
    if (!attRecord) {
      throw new Error("ATTENDANCE_NOT_FOUND");
    }

    const resendKey = `${tenantId}:${studentId}:${sessionId}:resend:${Date.now()}`;

    await whatsAppDispatcher.dispatchAttendanceWebhook({
      tenant_id: tenantId,
      event_type: "attendance_recorded",
      student_id: studentId,
      student_name: student.name,
      session_id: sessionId,
      attended: attRecord.attended,
      comment: attRecord.comment || null,
      parent_phone: student.parent_phone,
      idempotency_key: resendKey,
    });

    await this.repository.updateAttendanceStatus(attRecord.id, {
      sent: true,
      wa_status: "sent",
    });

    return {
      success: true,
      message: "Notification resent successfully",
      student_id: studentId,
      student_name: student.name,
      phone: student.parent_phone,
      resend_idempotency_key: resendKey,
    };
  }
}
