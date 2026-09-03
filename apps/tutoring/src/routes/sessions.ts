import { Router, Response } from "express";
import { AuthenticatedRequest, AttendanceRecordInput, AttendanceEvaluation } from "../types/index.js";
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
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create session" } });
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
      .select("id, tenant_id, group_id, session_number, session_date, created_at, groups(name, price, billing_model)")
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
      return;
    }

    const [attendanceRes, quizRes] = await Promise.all([
      supabase
        .from("attendance")
        .select("id, student_id, attended, comment, homework_status, is_makeup, home_group_id, sent, idempotency_key, created_at, students(id, name, student_code, parent_phone)")
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
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to retrieve session" } });
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
    const { student_id, student_code, homework_status, is_makeup, home_group_id, comment } = req.body;

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
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found in this tenant" } });
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
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Scan processing failed" } });
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
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to save quiz score" } });
    }
  }
);

// GET /api/sessions/:id/quiz-scores - Retrieve all quiz scores for a session
sessionsRouter.get("/:id/quiz-scores", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id: sessionId } = req.params;

  try {
    const { data: scores, error } = await supabase
      .from("quiz_scores")
      .select("id, student_id, score, max_score, created_at, updated_at, students(name, student_code)")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({ quiz_scores: scores || [] });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list quiz scores" } });
  }
});

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
        .select("id, group_id, session_number, session_date, groups(id, name, price, billing_model, fixed_rent_amount)")
        .eq("id", sessionId)
        .single();

      if (sessionErr || !session) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
        return;
      }

      const group = (session as any).groups;
      const basePrice = Number(group.price) || 0;

      // 2. Fetch all attendance records with student financial info
      const { data: attendees, error: attErr } = await supabase
        .from("attendance")
        .select("id, student_id, attended, is_makeup, home_group_id, students(id, name, fee_override, exempt)")
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

      const breakdown = (attendees || []).map((att: any) => {
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
      });

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
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Financial calculation failed" } });
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

      res.status(200).json({
        message: "Attendance recorded successfully",
        count: savedRows?.length || 0,
        attendance: savedRows,
        notification_decisions: evaluations,
      });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to record attendance" } });
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
    const { sync_items } = req.body as { sync_items: any[] };

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
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Batch sync processing failed" } });
    }
  }
);

