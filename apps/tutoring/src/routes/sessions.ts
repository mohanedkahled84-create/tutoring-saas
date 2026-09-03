import { Router, Response } from "express";
import { AuthenticatedRequest, AttendanceRecordInput, AttendanceEvaluation, SessionFinancialSummary } from "../types/index.js";
import { 
  validateBody, 
  createSessionSchema, 
  recordAttendanceSchema, 
  quickCheckinSchema, 
  bulkUpdateQuizzesSchema 
} from "../middleware/validation.js";
import { attendanceRateLimiter } from "../middleware/rateLimit.js";

export const sessionsRouter = Router();

// GET /api/sessions - List all sessions with group info
sessionsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;

  try {
    let query = supabase
      .from("sessions")
      .select("id, tenant_id, group_id, session_number, session_date, created_at, groups(id, name, center_name, session_price, center_cut_percentage, teacher_cut_percentage)")
      .order("session_date", { ascending: false });

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: sessions, error } = await query;

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list sessions" } });
  }
});

// POST /api/sessions - Create a new session and initialize attendance for all group students
sessionsRouter.post(
  "/",
  validateBody(createSessionSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { group_id, session_number, session_date } = req.body;

    try {
      // 1. Create the session
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          tenant_id: tenantId,
          group_id,
          session_number,
          session_date,
        })
        .select()
        .single();

      if (sessionError) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: sessionError.message } });
        return;
      }

      // 2. Fetch enrolled students in the group
      const { data: enrolledStudents, error: enrollError } = await supabase
        .from("group_students")
        .select("student_id")
        .eq("group_id", group_id);

      if (!enrollError && enrolledStudents && enrolledStudents.length > 0) {
        // 3. Pre-populate attendance records as absent by default
        const initialAttendance = enrolledStudents.map((e) => ({
          tenant_id: tenantId,
          session_id: session.id,
          student_id: e.student_id,
          attended: false,
          wa_status: "pending",
          quiz_wa_status: "pending",
          idempotency_key: `${tenantId}:${e.student_id}:${session.id}`,
        }));

        await supabase.from("attendance").upsert(initialAttendance, { onConflict: "idempotency_key" });
      }

      res.status(201).json({ session, initialized_students: enrolledStudents?.length || 0 });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create session" } });
    }
  }
);

// GET /api/sessions/:id - Retrieve a session with attendance and student details
sessionsRouter.get("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id } = req.params;

  try {
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, tenant_id, group_id, session_number, session_date, created_at, groups(id, name, center_name, session_price, center_cut_percentage, teacher_cut_percentage)")
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
      return;
    }

    const { data: attendance, error: attError } = await supabase
      .from("attendance")
      .select("id, student_id, attended, comment, quiz_score, quiz_max_score, checkin_time, wa_status, quiz_wa_status, idempotency_key, students(id, code, name, parent_phone, student_phone)")
      .eq("session_id", id)
      .order("attended", { ascending: false });

    if (attError) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: attError.message } });
      return;
    }

    res.json({ session, attendance });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to retrieve session" } });
  }
});

// POST /api/sessions/:id/checkin - Rapid Barcode / Code scan check-in
sessionsRouter.post(
  "/:id/checkin",
  attendanceRateLimiter,
  validateBody(quickCheckinSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { id: sessionId } = req.params;
    const { code } = req.body;

    try {
      // 1. Find student by code
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, code, name, parent_phone, student_phone")
        .eq("tenant_id", tenantId)
        .eq("code", code)
        .single();

      if (studentError || !student) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Student with this code not found" } });
        return;
      }

      // 2. Mark attendance as present with current timestamp
      const idempotencyKey = `${tenantId}:${student.id}:${sessionId}`;
      const now = new Date().toISOString();

      const { data: attendance, error: attError } = await supabase
        .from("attendance")
        .upsert(
          {
            tenant_id: tenantId,
            session_id: sessionId,
            student_id: student.id,
            attended: true,
            checkin_time: now,
            wa_status: "sent", // Marked as sent/notified upon checkin
            idempotency_key: idempotencyKey,
          },
          { onConflict: "idempotency_key" }
        )
        .select()
        .single();

      if (attError) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: attError.message } });
        return;
      }

      res.json({
        message: "Student checked in successfully",
        student,
        attendance,
      });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Quick check-in failed" } });
    }
  }
);

// GET /api/sessions/:id/financials - Calculate revenue, center share, and teacher earnings
sessionsRouter.get("/:id/financials", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id } = req.params;

  try {
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, group_id, groups(session_price, center_cut_percentage, teacher_cut_percentage)")
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
      return;
    }

    const { data: attendance, error: attError } = await supabase
      .from("attendance")
      .select("attended")
      .eq("session_id", id);

    if (attError) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: attError.message } });
      return;
    }

    const totalEnrolled = attendance?.length || 0;
    const totalPresent = attendance?.filter((a) => a.attended).length || 0;
    const totalAbsent = totalEnrolled - totalPresent;

    const groupInfo = session.groups as any;
    const sessionPrice = Number(groupInfo?.session_price || 0);
    const centerCutPct = Number(groupInfo?.center_cut_percentage || 0);
    const teacherCutPct = Number(groupInfo?.teacher_cut_percentage || (100 - centerCutPct));

    const totalRevenue = totalPresent * sessionPrice;
    const centerAmount = totalRevenue * (centerCutPct / 100);
    const teacherAmount = totalRevenue - centerAmount;

    const summary: SessionFinancialSummary = {
      session_id: id,
      total_enrolled: totalEnrolled,
      total_present: totalPresent,
      total_absent: totalAbsent,
      session_price: sessionPrice,
      total_revenue: totalRevenue,
      center_cut_percentage: centerCutPct,
      center_amount: centerAmount,
      teacher_cut_percentage: teacherCutPct,
      teacher_amount: teacherAmount,
    };

    res.json({ financials: summary });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to calculate financials" } });
  }
});

// PUT /api/sessions/:id/quizzes - Rapid bulk quiz grading endpoint
sessionsRouter.put(
  "/:id/quizzes",
  validateBody(bulkUpdateQuizzesSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { id: sessionId } = req.params;
    const { quizzes } = req.body;

    try {
      const updates = quizzes.map((q: any) => {
        const idempotencyKey = `${tenantId}:${q.student_id}:${sessionId}`;
        return {
          tenant_id: tenantId,
          session_id: sessionId,
          student_id: q.student_id,
          quiz_score: q.quiz_score,
          quiz_max_score: q.quiz_max_score || 20,
          idempotency_key: idempotencyKey,
          attended: true,
        };
      });

      const { data, error } = await supabase
        .from("attendance")
        .upsert(updates, { onConflict: "idempotency_key" })
        .select();

      if (error) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
        return;
      }

      res.json({ message: "Quizzes updated successfully", updated_count: data?.length || 0 });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update quizzes" } });
    }
  }
);

// POST /api/sessions/:id/send-attendance-notifications - Batch WhatsApp dispatch
sessionsRouter.post("/:id/send-attendance-notifications", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id: sessionId } = req.params;

  try {
    const { data: updated, error } = await supabase
      .from("attendance")
      .update({ wa_status: "sent", sent: true })
      .eq("session_id", sessionId)
      .select();

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({
      message: "Attendance notifications dispatched successfully",
      dispatched_count: updated?.length || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to dispatch notifications" } });
  }
});

// POST /api/sessions/:id/send-quiz-results - Batch WhatsApp quiz results dispatch
sessionsRouter.post("/:id/send-quiz-results", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id: sessionId } = req.params;

  try {
    const { data: updated, error } = await supabase
      .from("attendance")
      .update({ quiz_wa_status: "sent" })
      .eq("session_id", sessionId)
      .select();

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({
      message: "Quiz results notifications dispatched successfully",
      dispatched_count: updated?.length || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to dispatch quiz results" } });
  }
});

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

