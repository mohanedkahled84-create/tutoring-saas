import { Router, Response, Request } from "express";
import { validateBody, publicSelfRegisterSchema } from "../middleware/validation.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { verifyParentPortalToken } from "../utils/tokens.js";

export const publicRouter = Router();

// POST /api/public/register - Student Self-Registration from shareable link
publicRouter.post(
  "/register",
  validateBody(publicSelfRegisterSchema),
  async (req: Request, res: Response): Promise<void> => {
    const supabase = getServiceSupabaseClient();
    const { tenant_id, name, parent_phone, student_phone, group_id } = req.body;

    try {
      // 1. Insert student
      const { data: student, error: studentError } = await supabase
        .from("students")
        .insert({
          tenant_id,
          name,
          parent_phone,
          student_phone,
        })
        .select()
        .single();

      if (studentError) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: studentError.message } });
        return;
      }

      // 2. Enroll student into group
      await supabase.from("group_students").insert({
        tenant_id,
        student_id: student.id,
        group_id,
      });

      res.status(201).json({
        message: "تم تسجيل بيانات الطالب بنجاح",
        student,
        verification_message_queued: true,
      });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to self-register" } });
    }
  }
);

// DEV-34: GET /api/public/parent-portal - Lightweight No-App Student Portal
publicRouter.get("/parent-portal", async (req: Request, res: Response): Promise<void> => {
  const token = (req.query.token as string) || "";
  if (!token) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Token is required" } });
    return;
  }

  const verified = verifyParentPortalToken(token);
  if (!verified) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid, expired, or tampered parent portal link" },
    });
    return;
  }

  const { student_id, tenant_id } = verified;
  const supabase = getServiceSupabaseClient();

  try {
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, student_code")
      .eq("id", student_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (studentError || !student) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Student record not found" } });
      return;
    }

    const { data: attendanceRows, error: attError } = await supabase
      .from("attendance")
      .select("id, session_id, attended, comment, homework_status, created_at, sessions(session_number, session_date)")
      .eq("student_id", student_id)
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false })
      .limit(15);

    if (attError) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch attendance" } });
      return;
    }

    interface AttendanceWithSession {
      attended: boolean;
      homework_status?: string | null;
      comment?: string | null;
      created_at?: string;
      sessions?: {
        session_number?: number;
        session_date?: string;
      } | null;
    }

    const rawRows = (attendanceRows || []) as unknown as AttendanceWithSession[];
    const sessions = rawRows.map((row) => ({
      session_number: row.sessions?.session_number || 0,
      session_date: row.sessions?.session_date || row.created_at?.split("T")[0] || "",
      attended: row.attended,
      homework_status: row.homework_status || "done",
      comment: row.comment || null,
    }));

    const totalSessions = sessions.length;
    const attendedCount = sessions.filter((s) => s.attended).length;
    const absentCount = totalSessions - attendedCount;
    const attendanceRate = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 100;
    const homeworkDoneCount = sessions.filter((s) => s.homework_status === "done").length;

    res.json({
      student: {
        name: student.name,
        student_code: student.student_code || "—",
      },
      summary: {
        total_sessions: totalSessions,
        attended_count: attendedCount,
        absent_count: absentCount,
        attendance_rate: `${attendanceRate}%`,
        homework_done_count: homeworkDoneCount,
      },
      sessions,
    });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error retrieving portal" } });
  }
});

