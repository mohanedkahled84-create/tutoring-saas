import { SupabaseClient } from "@supabase/supabase-js";

export type RiskCategory = "absence_warning" | "grade_drop" | "homework_neglect";

export interface AtRiskStudent {
  student_id: string;
  student_name: string;
  student_code?: string | null;
  parent_phone: string;
  group_id?: string;
  group_name?: string;
  primary_risk: RiskCategory;
  risk_reasons: RiskCategory[];
  severity: "high" | "medium";
  metrics: {
    consecutive_absences: number;
    recent_quiz_avg: number | null;
    consecutive_missing_hw: number;
  };
  recommended_action: string;
}

export async function computeAtRiskWatchlist(
  supabase: SupabaseClient,
  tenantId: string,
  groupId?: string
): Promise<AtRiskStudent[]> {
  // 1. Fetch students for tenant (optionally filtered by group)
  const studentQuery = supabase
    .from("students")
    .select("id, name, student_code, parent_phone, tenant_id")
    .eq("tenant_id", tenantId);

  const { data: students, error: studentErr } = await studentQuery;
  if (studentErr || !students || students.length === 0) {
    return [];
  }

  // 2. Fetch recent sessions (last 10 sessions for tenant/group)
  let sessionsQuery = supabase
    .from("sessions")
    .select("id, group_id, session_number, session_date, groups(name)")
    .eq("tenant_id", tenantId)
    .order("session_date", { ascending: false })
    .limit(15);

  if (groupId) {
    sessionsQuery = sessionsQuery.eq("group_id", groupId);
  }

  const { data: sessions } = await sessionsQuery;
  if (!sessions || sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((s) => s.id);

  // 3. Fetch attendance records for these sessions
  const { data: attendanceRecords } = await supabase
    .from("attendance")
    .select("id, session_id, student_id, attended, homework_status, created_at")
    .in("session_id", sessionIds);

  // 4. Fetch quiz scores for these students
  const studentIds = students.map((s) => s.id);
  const { data: quizScores } = await supabase
    .from("quiz_scores")
    .select("student_id, session_id, score, max_score, created_at")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });

  const watchlist: AtRiskStudent[] = [];

  for (const student of students) {
    // A. Attendance & Homework analysis (ordered most recent first)
    const studentAtt = (attendanceRecords || [])
      .filter((a) => a.student_id === student.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Check consecutive absences in latest recorded sessions
    let consecutiveAbsences = 0;
    for (const att of studentAtt) {
      if (!att.attended) {
        consecutiveAbsences += 1;
      } else {
        break;
      }
    }

    // Check consecutive missing homework
    let consecutiveMissingHw = 0;
    for (const att of studentAtt) {
      if (att.homework_status === "missing") {
        consecutiveMissingHw += 1;
      } else if (att.homework_status === "done" || att.homework_status === "partial") {
        break;
      }
    }

    // B. Quiz average across last 3 quiz scores
    const studentQuizzes = (quizScores || [])
      .filter((q) => q.student_id === student.id)
      .slice(0, 3);
    let quizAvg: number | null = null;

    if (studentQuizzes.length > 0) {
      const totalPct = studentQuizzes.reduce(
        (sum, q) => sum + Number(q.score) / Number(q.max_score),
        0
      );
      quizAvg = Math.round((totalPct / studentQuizzes.length) * 100);
    }

    // C. Evaluate Risk Flags (Exact thresholds from DEV-32 spec)
    const riskReasons: RiskCategory[] = [];

    // Threshold 1: Absent in the last 2 sessions
    if (consecutiveAbsences >= 2) {
      riskReasons.push("absence_warning");
    }

    // Threshold 2: Quiz average below 50% over the last 3 quizzes
    if (quizAvg !== null && quizAvg < 50) {
      riskReasons.push("grade_drop");
    }

    // Threshold 3: 2+ consecutive homework_status = 'missing'
    if (consecutiveMissingHw >= 2) {
      riskReasons.push("homework_neglect");
    }

    if (riskReasons.length > 0) {
      // Primary risk priority: absence > grade drop > homework neglect
      const primaryRisk = riskReasons[0];
      const severity =
        consecutiveAbsences >= 3 || (quizAvg !== null && quizAvg < 30) || riskReasons.length >= 2
          ? "high"
          : "medium";

      let recommendedAction = "إرسال تنبيه بالمتابعة لولي الأمر";
      if (primaryRisk === "absence_warning") {
        recommendedAction = "تنبيه غياب متكرر والاتصال بولي الأمر فوراً";
      } else if (primaryRisk === "grade_drop") {
        recommendedAction = "إشعار بانخفاض مستوى درجات الاختبارات وطلب جلسة تقوية";
      } else if (primaryRisk === "homework_neglect") {
        recommendedAction = "إخطار ولي الأمر بعدم تسليم الواجب المنزلي لمرتين متتاليتين";
      }

      watchlist.push({
        student_id: student.id,
        student_name: student.name,
        student_code: student.student_code,
        parent_phone: student.parent_phone,
        primary_risk: primaryRisk,
        risk_reasons: riskReasons,
        severity,
        metrics: {
          consecutive_absences: consecutiveAbsences,
          recent_quiz_avg: quizAvg,
          consecutive_missing_hw: consecutiveMissingHw,
        },
        recommended_action: recommendedAction,
      });
    }
  }

  // Sort by severity (high first) then by name
  return watchlist.sort((a, b) => {
    if (a.severity === "high" && b.severity !== "high") return -1;
    if (a.severity !== "high" && b.severity === "high") return 1;
    return a.student_name.localeCompare(b.student_name);
  });
}
