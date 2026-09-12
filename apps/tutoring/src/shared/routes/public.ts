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

// DEV-34: GET /api/public/parent-portal - Lightweight No-App Student Portal with Quizzes & Attendance
publicRouter.get("/parent-portal", async (req: Request, res: Response): Promise<void> => {
  const token = (req.query.token as string) || "";
  if (!token) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Token is required" } });
    return;
  }

  const supabase = getServiceSupabaseClient();
  const verified = verifyParentPortalToken(token);

  let studentId = verified?.student_id;
  let tenantId = verified?.tenant_id;

  try {
    let student: any = null;

    if (studentId && tenantId) {
      const { data, error } = await supabase
        .from("students")
        .select("id, tenant_id, name, code, student_code, group_students(group_id, groups(name, center_name))")
        .eq("id", studentId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!error && data) {
        student = data;
      }
    }

    // Fallback: look up by parent_portal_token directly if HMAC token was expired or stored token passed
    if (!student) {
      const { data, error } = await supabase
        .from("students")
        .select("id, tenant_id, name, code, student_code, group_students(group_id, groups(name, center_name))")
        .eq("parent_portal_token", token)
        .maybeSingle();
      if (!error && data) {
        student = data;
        studentId = data.id;
        tenantId = data.tenant_id;
      }
    }

    if (!student || !studentId || !tenantId) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "رابط المتابعة غير صالح أو منتهي الصلاحية. يرجى التواصل مع إدارة السنتر." },
      });
      return;
    }

    // 1. Fetch Attendance History
    const { data: attendanceRows } = await supabase
      .from("attendance")
      .select("id, session_id, attended, comment, homework_status, created_at, sessions(session_number, session_date)")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20);

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

    const rawAttRows = (attendanceRows || []) as unknown as AttendanceWithSession[];
    const sessions = rawAttRows.map((row) => ({
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

    // 2. Fetch Quiz Scores & Exam Results
    const { data: quizScoreRows } = await supabase
      .from("quiz_scores")
      .select("id, score, max_score, note, created_at, quiz_number, quiz_id, quizzes(title, max_score, quiz_date)")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(25);

    const quizzes = ((quizScoreRows as any[]) || []).map((q) => {
      const score = Number(q.score) || 0;
      const maxScore = Number(q.max_score || q.quizzes?.max_score || 10);
      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      const tier = percentage >= 85 ? "ممتاز" : percentage >= 65 ? "جيد" : "يحتاج متابعة";
      return {
        id: q.id,
        title: q.quizzes?.title || `كويز ${q.quiz_number || ""}`,
        score,
        max_score: maxScore,
        percentage,
        tier,
        date: q.quizzes?.quiz_date || q.created_at?.split("T")[0] || "",
        note: q.note || null,
      };
    });

    const totalQuizzes = quizzes.length;
    const quizAvgPercentage = totalQuizzes > 0
      ? Math.round(quizzes.reduce((acc, q) => acc + q.percentage, 0) / totalQuizzes)
      : null;

    // Extract Group Information
    const rawGs = student.group_students;
    const gsList = Array.isArray(rawGs) ? rawGs : (rawGs ? [rawGs] : []);
    const groupName = gsList[0]?.groups?.name || "مجموعة عامة";

    res.json({
      student: {
        id: student.id,
        name: student.name,
        student_code: student.code || student.student_code || "—",
        group_name: groupName,
      },
      summary: {
        total_sessions: totalSessions,
        attended_count: attendedCount,
        absent_count: absentCount,
        attendance_rate: `${attendanceRate}%`,
        homework_done_count: homeworkDoneCount,
        total_quizzes: totalQuizzes,
        quiz_average_percentage: quizAvgPercentage !== null ? `${quizAvgPercentage}%` : "—",
      },
      quizzes,
      sessions,
      last_updated: new Date().toISOString(),
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "حدث خطأ أثناء تحميل بيانات المتابعة" },
    });
  }
});

