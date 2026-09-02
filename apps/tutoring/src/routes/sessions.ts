import { Router, Response } from "express";
import { AuthenticatedRequest, AttendanceRecordInput, AttendanceEvaluation } from "../types/index.js";
import { validateBody, createSessionSchema, recordAttendanceSchema } from "../middleware/validation.js";
import { attendanceRateLimiter } from "../middleware/rateLimit.js";

export const sessionsRouter = Router();

// POST /api/sessions - Create a new session (validated with Zod)
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

// GET /api/sessions/:id - Retrieve a session with attendance records
sessionsRouter.get("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id } = req.params;

  try {
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, tenant_id, group_id, session_number, session_date, created_at, groups(name)")
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
      return;
    }

    const { data: attendance, error: attError } = await supabase
      .from("attendance")
      .select("id, student_id, attended, comment, sent, idempotency_key, students(id, name, parent_phone)")
      .eq("session_id", id);

    if (attError) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: attError.message } });
      return;
    }

    res.json({ session, attendance });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to retrieve session" } });
  }
});

// Helper function to evaluate notification decision logic per contract
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

// POST /api/sessions/:id/attendance - Rate-limited & validated attendance recording
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
      // 1. Prepare rows with unique idempotency key
      const attendanceInserts = records.map((r) => {
        const idempotencyKey = `${tenantId}:${r.student_id}:${sessionId}`;
        return {
          tenant_id: tenantId,
          session_id: sessionId,
          student_id: r.student_id,
          attended: r.attended,
          comment: r.comment || null,
          sent: false,
          idempotency_key: idempotencyKey,
        };
      });

      // 2. Upsert rows into Supabase
      const { data: savedRows, error: saveError } = await supabase
        .from("attendance")
        .upsert(attendanceInserts, { onConflict: "idempotency_key" })
        .select();

      if (saveError) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: saveError.message } });
        return;
      }

      // 3. Compute notification decisions according to product specification
      const evaluations: AttendanceEvaluation[] = records.map((r) => {
        const idempotencyKey = `${tenantId}:${r.student_id}:${sessionId}`;
        const decision = evaluateNotificationDecision(r.attended, r.comment);

        return {
          student_id: r.student_id,
          attended: r.attended,
          comment: r.comment || null,
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
