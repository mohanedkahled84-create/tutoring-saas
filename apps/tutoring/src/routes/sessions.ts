import { Router, Response } from "express";
import { AuthenticatedRequest, AttendanceRecordInput, AttendanceEvaluation } from "../types/index.js";

export const sessionsRouter = Router();

// POST /api/sessions - Create a new session
sessionsRouter.post("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;
  const { group_id, session_number, session_date } = req.body;

  if (!group_id || session_number === undefined || !session_date) {
    res.status(400).json({ error: "group_id, session_number, and session_date are required" });
    return;
  }

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
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ session: data });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create session", details: err.message });
  }
});

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
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const { data: attendance, error: attError } = await supabase
      .from("attendance")
      .select("id, student_id, attended, comment, sent, idempotency_key, students(id, name, parent_phone)")
      .eq("session_id", id);

    if (attError) {
      res.status(400).json({ error: attError.message });
      return;
    }

    res.json({ session, attendance });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve session", details: err.message });
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

// POST /api/sessions/:id/attendance - Record attendance and compute notification decisions
sessionsRouter.post("/:id/attendance", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;
  const { id: sessionId } = req.params;
  const { records } = req.body as { records: AttendanceRecordInput[] };

  if (!records || !Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: "records array is required and must not be empty" });
    return;
  }

  try {
    // 1. Prepare rows with idempotency key
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

    // 2. Insert or upsert attendance rows into Supabase
    const { data: savedRows, error: saveError } = await supabase
      .from("attendance")
      .upsert(attendanceInserts, { onConflict: "idempotency_key" })
      .select();

    if (saveError) {
      res.status(400).json({ error: saveError.message });
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
    res.status(500).json({ error: "Failed to record attendance", details: err.message });
  }
});
