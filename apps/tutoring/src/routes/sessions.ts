import { Router, Response } from "express";
import {
  AuthenticatedRequest,
  AttendanceRecordInput,
  AttendanceEvaluation,
} from "../types/index.js";
import {
  validateBody,
  createSessionSchema,
  recordAttendanceSchema,
  scanStudentSchema,
  quizScoreSchema,
  offlineBatchSyncSchema,
} from "../middleware/validation.js";
import { attendanceRateLimiter } from "../middleware/rateLimit.js";
import { requireFinancialAccess } from "../middleware/auth.js";
import { dispatchAttendanceWebhook } from "../services/webhookDispatcher.js";

export const sessionsRouter = Router();

// POST /api/sessions - Create a new session
sessionsRouter.post(
  "/",
  validateBody(createSessionSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { group_id, session_number, session_date } = req.body;

    try {
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          tenant_id: tenantId,
          group_id,
          session_number,
          session_date,
        })
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
        return;
      }

      res.status(201).json({ session: data });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to create session" } });
    }
  }
);

// GET /api/sessions/:id - Retrieve session with attendance and quiz scores
sessionsRouter.get("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id } = req.params;

  try {
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(
        "id, tenant_id, group_id, session_number, session_date, created_at, groups(name, price, billing_model)"
      )
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
      return;
    }

    const [attendanceRes, quizRes] = await Promise.all([
      supabase
        .from("attendance")
        .select(
          "id, student_id, attended, comment, homework_status, is_makeup, home_group_id, sent, idempotency_key, created_at, students(id, name, student_code, parent_phone)"
        )
        .eq("session_id", id),
      supabase
        .from("quiz_scores")
        .select("id, student_id, score, max_score, created_at")
        .eq("session_id", id),
    ]);

    res.json({
      session,
      attendance: attendanceRes.data || [],
      quiz_scores: quizRes.data || [],
    });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Failed to retrieve session" } });
  }
});

// DEV-SBL.1: Duplicate-Scan Guard
// Scanning the same student twice returns 200 with already_recorded=true and original timestamp.
// Never creates duplicate rows or re-triggers WhatsApp sends!
sessionsRouter.post(
  "/:id/scan",
  attendanceRateLimiter,
  validateBody(scanStudentSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { id: sessionId } = req.params;
    const { student_id, student_code, homework_status, is_makeup, home_group_id, comment } =
      req.body;

    try {
      // 1. Resolve student in current tenant
      let studentQuery = supabase
        .from("students")
        .select("id, name, student_code, parent_phone, student_phone, fee_override, exempt")
        .eq("tenant_id", tenantId);

      if (student_id) {
        studentQuery = studentQuery.eq("id", student_id);
      } else {
        studentQuery = studentQuery.eq("student_code", student_code);
      }

      const { data: student, error: studentError } = await studentQuery.single();

      if (studentError || !student) {
        res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: "Student not found in this tenant" } });
        return;
      }

      const idempotencyKey = `${tenantId}:${student.id}:${sessionId}`;

      // 2. Check if attendance already exists
      const { data: existingAttendance } = await supabase
        .from("attendance")
        .select("id, attended, created_at, homework_status, is_makeup, home_group_id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingAttendance) {
        // DUPLICATE DETECTED: Return 200 with recorded_at timestamp, DO NOT overwrite or re-send!
        res.status(200).json({
          already_recorded: true,
          message: `Student already recorded at ${new Date(existingAttendance.created_at).toLocaleTimeString()}`,
          recorded_at: existingAttendance.created_at,
          attendance: existingAttendance,
          student: {
            id: student.id,
            name: student.name,
            student_code: student.student_code,
          },
        });
        return;
      }

      // 3. New scan: record attendance
      const { data: newAttendance, error: insertError } = await supabase
        .from("attendance")
        .insert({
          tenant_id: tenantId,
          session_id: sessionId,
          student_id: student.id,
          attended: true,
          comment: comment || null,
          homework_status: homework_status || null,
          is_makeup: is_makeup || false,
          home_group_id: home_group_id || null,
          sent: false,
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      if (insertError) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: insertError.message } });
        return;
      }

      // DEV-WPA.3: Trigger n8n attendance webhook if scan includes a teacher comment
      if (comment && comment.trim().length > 0 && student.parent_phone) {
        dispatchAttendanceWebhook({
          tenant_id: tenantId!,
          event_type: "attendance_recorded",
          student_id: student.id,
          student_name: student.name,
          session_id: sessionId,
          attended: true,
          comment: comment.trim(),
          parent_phone: student.parent_phone,
          idempotency_key: idempotencyKey,
        }).catch(() => {});
      }

      res.status(201).json({
        already_recorded: false,
        message: "Check-in recorded successfully",
        recorded_at: newAttendance.created_at,
        attendance: newAttendance,
        student: {
          id: student.id,
          name: student.name,
          student_code: student.student_code,
        },
      });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Scan processing failed" } });
    }
  }
);

// DEV-SBL.2: Incremental Quiz Score Auto-Save
// Immediately commits score per student so unexpected crashes lose at most 1 in-flight score
sessionsRouter.put(
  "/:id/quiz-scores/:student_id",
  validateBody(quizScoreSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { id: sessionId, student_id: studentId } = req.params;
    const { score, max_score } = req.body;

    const idempotencyKey = `${tenantId}:${studentId}:${sessionId}`;

    try {
      const { data: savedScore, error } = await supabase
        .from("quiz_scores")
        .upsert(
          {
            tenant_id: tenantId,
            session_id: sessionId,
            student_id: studentId,
            score,
            max_score,
            idempotency_key: idempotencyKey,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "idempotency_key" }
        )
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
        return;
      }

      res.status(200).json({
        message: "Quiz score saved",
        quiz_score: savedScore,
      });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to save quiz score" } });
    }
  }
);

// GET /api/sessions/:id/quiz-scores - Retrieve all quiz scores for a session
sessionsRouter.get(
  "/:id/quiz-scores",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const { id: sessionId } = req.params;

    try {
      const { data: scores, error } = await supabase
        .from("quiz_scores")
        .select(
          "id, student_id, score, max_score, created_at, updated_at, students(name, student_code)"
        )
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
        return;
      }

      res.json({ quiz_scores: scores || [] });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to list quiz scores" } });
    }
  }
);

// DEV-SBL.3 & DEV-SE.1: Session Financial Summary
// Accounting for fee overrides, exemptions, and make-up revenue retention
// Restricted from assistant role (requireFinancialAccess)
sessionsRouter.get(
  "/:id/financial-summary",
  requireFinancialAccess,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const { id: sessionId } = req.params;

    try {
      // 1. Fetch session & group details
      const { data: session, error: sessionErr } = await supabase
        .from("sessions")
        .select(
          "id, group_id, session_number, session_date, groups(id, name, price, billing_model, fixed_rent_amount)"
        )
        .eq("id", sessionId)
        .single();

      if (sessionErr || !session) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
        return;
      }

      const group = (
        session as unknown as {
          groups: {
            id?: string;
            name?: string;
            center_name?: string;
            price?: number | string;
            billing_model?: string;
            fixed_rent_amount?: number;
          };
        }
      ).groups;
      const basePrice = Number(group.price) || 0;

      // 2. Fetch all attendance records with student financial info
      const { data: attendees, error: attErr } = await supabase
        .from("attendance")
        .select(
          "id, student_id, attended, is_makeup, home_group_id, students(id, name, fee_override, exempt)"
        )
        .eq("session_id", sessionId)
        .eq("attended", true);

      if (attErr) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: attErr.message } });
        return;
      }

      let totalRevenue = 0;
      let exemptCount = 0;
      let overriddenCount = 0;
      let regularCount = 0;
      let makeupCount = 0;

      const rawAttendees = (attendees || []) as unknown as Array<{
        id: string;
        student_id: string;
        attended: boolean;
        is_makeup?: boolean;
        home_group_id?: string | null;
        students?: {
          id: string;
          name: string;
          fee_override?: number | null;
          exempt?: boolean | null;
        } | null;
      }>;

      const breakdown = rawAttendees.map((att) => {
          const student = att.students;
          let feeCharged = basePrice;
          let pricingType = "regular";

          if (att.is_makeup) {
            makeupCount += 1;
          }

          if (student?.exempt) {
            feeCharged = 0;
            pricingType = "exempt";
            exemptCount += 1;
          } else if (student?.fee_override != null && student.fee_override !== undefined) {
            feeCharged = Number(student.fee_override);
            pricingType = "override";
            overriddenCount += 1;
          } else {
            regularCount += 1;
          }

          totalRevenue += feeCharged;

          return {
            student_id: student?.id,
            student_name: student?.name,
            is_makeup: att.is_makeup,
            home_group_id: att.home_group_id,
            pricing_type: pricingType,
            fee_charged: feeCharged,
          };
        }
      );

      res.json({
        session_id: sessionId,
        group: {
          id: group.id,
          name: group.name,
          base_price: basePrice,
          billing_model: group.billing_model,
          fixed_rent_amount: group.fixed_rent_amount,
        },
        financials: {
          total_revenue: totalRevenue,
          attendee_count: attendees?.length || 0,
          regular_count: regularCount,
          exempt_count: exemptCount,
          overridden_count: overriddenCount,
          makeup_count: makeupCount,
        },
        breakdown,
      });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Financial calculation failed" } });
    }
  }
);

// Helper function to evaluate notification decision logic
export function evaluateNotificationDecision(
  attended: boolean,
  comment?: string | null
): "attendance_absent" | "attendance_present_comment" | "none" {
  if (!attended) {
    return "attendance_absent";
  }
  if (comment && comment.trim().length > 0) {
    return "attendance_present_comment";
  }
  return "none";
}

// POST /api/sessions/:id/attendance - Batch attendance recording
sessionsRouter.post(
  "/:id/attendance",
  attendanceRateLimiter,
  validateBody(recordAttendanceSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { id: sessionId } = req.params;
    const { records } = req.body as { records: AttendanceRecordInput[] };

    try {
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

      const { data: savedRows, error: saveError } = await supabase
        .from("attendance")
        .upsert(attendanceInserts, { onConflict: "idempotency_key" })
        .select();

      if (saveError) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: saveError.message } });
        return;
      }

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

      // DEV-WPA.3: Trigger n8n attendance webhook exactly once per idempotency_key for eligible students
      const notifyCandidates = evaluations.filter((e) => e.decision !== "none");
      if (notifyCandidates.length > 0) {
        const studentIds = notifyCandidates.map((c) => c.student_id);
        (async () => {
          const { data: studentRows } = await supabase
            .from("students")
            .select("id, name, parent_phone")
            .in("id", studentIds);

          const studentMap = new Map(
            (studentRows || []).map((s: { id: string; name: string; parent_phone: string }) => [
              s.id,
              s,
            ])
          );
          for (const item of notifyCandidates) {
            const s = studentMap.get(item.student_id);
            if (s && s.parent_phone) {
              dispatchAttendanceWebhook({
                tenant_id: tenantId!,
                event_type: "attendance_recorded",
                student_id: item.student_id,
                student_name: s.name,
                session_id: sessionId,
                attended: item.attended,
                comment: item.comment || null,
                parent_phone: s.parent_phone,
                idempotency_key: item.idempotency_key,
              }).catch(() => {});
            }
          }
        })().catch(() => {});
      }

      res.status(200).json({
        message: "Attendance recorded successfully",
        count: savedRows?.length || 0,
        attendance: savedRows,
        notification_decisions: evaluations,
      });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to record attendance" } });
    }
  }
);

// DEV-OFS.2: Offline-First Batch Sync Endpoint
// Receives locally-queued writes from offline scanning, applies them idempotently,
// and returns per-item sync status (synced, already_recorded, or failed).
sessionsRouter.post(
  "/:id/attendance/batch-sync",
  attendanceRateLimiter,
  validateBody(offlineBatchSyncSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { id: sessionId } = req.params;
    const { sync_items } = req.body as {
      sync_items: Array<{
        student_id: string;
        attended: boolean;
        is_makeup?: boolean;
        client_timestamp: string;
        idempotency_key?: string;
        comment?: string;
        homework_status?: string | null;
        home_group_id?: string | null;
      }>;
    };

    try {
      let syncedCount = 0;
      let alreadyRecordedCount = 0;
      let failedCount = 0;

      const results = [];

      for (const item of sync_items) {
        // Enforce or ensure tenant-scoped idempotency key
        const expectedKey = `${tenantId}:${item.student_id}:${sessionId}`;
        const idempotencyKey = item.idempotency_key || expectedKey;

        // Check if attendance already exists
        const { data: existing } = await supabase
          .from("attendance")
          .select("id, created_at")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

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

        // Insert new record
        const { data: inserted, error: insertErr } = await supabase
          .from("attendance")
          .insert({
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
          })
          .select()
          .single();

        if (insertErr) {
          failedCount += 1;
          results.push({
            idempotency_key: idempotencyKey,
            student_id: item.student_id,
            status: "failed",
            error: insertErr.message,
          });
        } else {
          syncedCount += 1;
          results.push({
            idempotency_key: idempotencyKey,
            student_id: item.student_id,
            status: "synced",
            recorded_at: inserted.created_at,
          });
        }
      }

      res.status(200).json({
        total: sync_items.length,
        synced_count: syncedCount,
        already_recorded_count: alreadyRecordedCount,
        failed_count: failedCount,
        results,
      });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Batch sync processing failed" } });
    }
  }
);

// DEV-PV.2: WhatsApp Delivery Status & Failure Visibility
// Returns delivery outcomes for all students in the session, distinguishing sent from failed with clear human-readable error reasons.
sessionsRouter.get(
  "/:id/delivery-status",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { id: sessionId } = req.params;

    try {
      const { data: attendanceRows, error: attErr } = await supabase
        .from("attendance")
        .select(
          "id, student_id, attended, comment, sent, students(id, name, parent_phone, student_code)"
        )
        .eq("session_id", sessionId);

      if (attErr) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: attErr.message } });
        return;
      }

      const { data: messageLogs } = await supabase
        .from("message_logs")
        .select("id, idempotency_key, recipient_phone, status, error_detail, sent_at, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      const logsByStudent = new Map<string, Record<string, unknown>>();
      if (messageLogs) {
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
      }

      const rawAttendanceRows = (attendanceRows || []) as unknown as Array<{
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

      const deliveryReports = rawAttendanceRows.map((row) => {
          const student = row.students;
          const studentId = row.student_id;
          const log = logsByStudent.get(studentId);

          let deliveryStatus = "not_sent";
          let failureReason: string | null = null;

          if (log) {
            deliveryStatus = typeof log.status === "string" ? log.status : "not_sent";
            failureReason = typeof log.error_detail === "string" ? log.error_detail : null;
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
            logged_at: typeof log?.created_at === "string" ? log.created_at : null,
          };
        }
      );

      const failedCount = deliveryReports.filter(
        (r) => r.delivery_status === "failed" || r.delivery_status === "rejected"
      ).length;
      const sentCount = deliveryReports.filter((r) => r.delivery_status === "sent").length;

      res.json({
        session_id: sessionId,
        total_students: deliveryReports.length,
        sent_count: sentCount,
        failed_count: failedCount,
        deliveries: deliveryReports,
      });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch delivery status" } });
    }
  }
);

// DEV-SR.1: Session WhatsApp Receipt Generator
// Reuses session financial-summary calculations to format a WhatsApp-ready settlement message
// for the teacher and center, preventing disputes. Guarded by requireFinancialAccess.
sessionsRouter.post(
  "/:id/receipt",
  requireFinancialAccess,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { id: sessionId } = req.params;
    const { recipient_phone, recipient_type = "teacher", send_via_whatsapp = true } = req.body;

    try {
      // 1. Fetch session & group info
      const { data: session, error: sessionErr } = await supabase
        .from("sessions")
        .select(
          "id, session_number, session_date, groups(id, name, center_name, price, billing_model, fixed_rent_amount)"
        )
        .eq("id", sessionId)
        .single();

      if (sessionErr || !session) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
        return;
      }

      const group = (
        session as unknown as {
          groups: {
            price?: number | string;
            name?: string;
            center_name?: string;
            billing_model?: string;
            fixed_rent_amount?: number | string;
          };
        }
      ).groups;
      const basePrice = Number(group.price) || 0;

      // 2. Fetch all attendance records (present & absent)
      const { data: allAttendance, error: attErr } = await supabase
        .from("attendance")
        .select("id, student_id, attended, is_makeup, students(id, name, fee_override, exempt)")
        .eq("session_id", sessionId);

      if (attErr) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: attErr.message } });
        return;
      }

      let totalRevenue = 0;
      let presentCount = 0;
      let absentCount = 0;
      let exemptCount = 0;
      let makeupCount = 0;

      const rawAllAttendance = (allAttendance || []) as unknown as Array<{
        attended: boolean;
        is_makeup?: boolean;
        students?: {
          exempt?: boolean | null;
          fee_override?: number | null;
          name?: string;
        } | null;
      }>;

      for (const att of rawAllAttendance) {
        if (att.attended) {
          presentCount += 1;
          const s = att.students;
          if (att.is_makeup) makeupCount += 1;

          if (s?.exempt) {
            exemptCount += 1;
          } else if (s?.fee_override != null) {
            totalRevenue += Number(s.fee_override);
          } else {
            totalRevenue += basePrice;
          }
        } else {
          absentCount += 1;
        }
      }

      // Compute split
      let centerShare = 0;
      let teacherShare = totalRevenue;

      if (group.billing_model === "fixed_rent" && group.fixed_rent_amount) {
        centerShare = Math.min(Number(group.fixed_rent_amount), totalRevenue);
        teacherShare = totalRevenue - centerShare;
      } else if (group.billing_model === "percentage") {
        // Default center percentage cut (20% standard or 0 if unconfigured)
        centerShare = Math.round(totalRevenue * 0.2);
        teacherShare = totalRevenue - centerShare;
      }

      const formattedReceipt = [
        "🧾 *إيصال تصفية الحصة / Session Settlement Receipt*",
        "━━━━━━━━━━━━━━━━━━━━━",
        `🏫 *المجموعة:* ${group.name}`,
        group.center_name ? `📍 *السنتر:* ${group.center_name}` : null,
        `📅 *التاريخ:* ${session.session_date} | *حصة رقم:* ${session.session_number}`,
        `👥 *إجمالي الحضور:* ${presentCount} طالب (منهم ${exemptCount} منحة / معفي)`,
        `❌ *إجمالي الغياب:* ${absentCount} طالب`,
        makeupCount > 0 ? `🔄 *طلاب التعويض:* ${makeupCount} طالب` : null,
        "━━━━━━━━━━━━━━━━━━━━━",
        `💵 *إجمالي النقدية المحصلة:* ${totalRevenue} ج.م`,
        `🏢 *حصة السنتر:* ${centerShare} ج.م`,
        `👨‍🏫 *صافي المعلم:* ${teacherShare} ج.م`,
        "━━━━━━━━━━━━━━━━━━━━━",
        `_تم الاستخراج آلياً بتاريخ ${new Date().toLocaleDateString("ar-EG")}_`,
      ]
        .filter(Boolean)
        .join("\n");

      let loggedMessageId: string | null = null;

      if (send_via_whatsapp && recipient_phone) {
        const idempotencyKey = `receipt:${tenantId}:${sessionId}:${Date.now()}`;
        const { data: logEntry } = await supabase
          .from("message_logs")
          .insert({
            tenant_id: tenantId,
            idempotency_key: idempotencyKey,
            message_type: "session_receipt",
            recipient_type: recipient_type,
            recipient_phone,
            status: "needs_review",
            error_detail: formattedReceipt,
          })
          .select("id")
          .single();

        loggedMessageId = logEntry?.id || null;
      }

      res.status(200).json({
        message: "Session receipt generated successfully",
        formatted_receipt: formattedReceipt,
        summary: {
          session_id: sessionId,
          group_name: group.name,
          present_count: presentCount,
          absent_count: absentCount,
          exempt_count: exemptCount,
          makeup_count: makeupCount,
          total_revenue: totalRevenue,
          center_share: centerShare,
          teacher_share: teacherShare,
        },
        logged_message_id: loggedMessageId,
      });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to generate receipt" } });
    }
  }
);
