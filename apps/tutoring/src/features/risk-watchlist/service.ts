import {
  IRiskWatchlistRepository,
  AtRiskStudent,
  RiskCategory,
  AlertType,
  QueuedAlertResult,
} from "./types.js";

export class RiskWatchlistService {
  constructor(private readonly repository: IRiskWatchlistRepository) {}

  /**
   * Computes the at-risk student watchlist for a tenant based on:
   * 1. Consecutive absences (>= 2)
   * 2. Quiz average drop (< 50% over last 3 quizzes)
   * 3. Consecutive missing homework (>= 2)
   */
  async computeWatchlist(
    tenantId: string,
    groupId?: string
  ): Promise<AtRiskStudent[]> {
    // 1. Fetch students
    const students = await this.repository.getStudents(tenantId);
    if (students.length === 0) {
      return [];
    }

    // 2. Fetch recent sessions
    const sessions = await this.repository.getRecentSessions(tenantId, groupId, 15);
    if (sessions.length === 0) {
      return [];
    }

    const sessionIds = sessions.map((s) => s.id);

    // 3. Fetch attendance records
    const attendanceRecords = await this.repository.getAttendanceForSessions(sessionIds);

    // 4. Fetch quiz scores
    const studentIds = students.map((s) => s.id);
    const quizScores = await this.repository.getQuizScoresForStudents(studentIds);

    const watchlist: AtRiskStudent[] = [];

    for (const student of students) {
      // Analyze attendance & homework history (ordered newest to oldest)
      const studentAtt = attendanceRecords
        .filter((a) => a.student_id === student.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      let consecutiveAbsences = 0;
      for (const att of studentAtt) {
        if (!att.attended) {
          consecutiveAbsences += 1;
        } else {
          break;
        }
      }

      let consecutiveMissingHw = 0;
      for (const att of studentAtt) {
        if (att.homework_status === "missing") {
          consecutiveMissingHw += 1;
        } else if (att.homework_status === "done" || att.homework_status === "partial") {
          break;
        }
      }

      // Quiz average across last 3 quiz scores
      const studentQuizzes = quizScores
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

      // Evaluate Risk Flags
      const riskReasons: RiskCategory[] = [];

      if (consecutiveAbsences >= 2) {
        riskReasons.push("absence_warning");
      }

      if (quizAvg !== null && quizAvg < 50) {
        riskReasons.push("grade_drop");
      }

      if (consecutiveMissingHw >= 2) {
        riskReasons.push("homework_neglect");
      }

      if (riskReasons.length > 0) {
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

  /**
   * Queues an at-risk alert for delivery to parent with idempotency
   */
  async queueAlert(
    tenantId: string,
    studentId: string,
    alertType: AlertType,
    customMessage?: string | null
  ): Promise<QueuedAlertResult> {
    const student = await this.repository.getStudentById(tenantId, studentId);
    if (!student) {
      throw new Error("STUDENT_NOT_FOUND");
    }

    const todayDate = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `${tenantId}:${student.id}:alert:${alertType}:${todayDate}`;

    const record = await this.repository.upsertAlertLog({
      tenant_id: tenantId,
      student_id: student.id,
      idempotency_key: idempotencyKey,
      message_type: alertType,
      recipient_type: "parent",
      recipient_phone: student.parent_phone,
      status: "needs_review",
      error_detail: customMessage || null,
    });

    return {
      student_id: student.id,
      student_name: student.name,
      recipient_phone: student.parent_phone,
      alert_type: alertType,
      idempotency_key: idempotencyKey,
      status: record.status,
    };
  }
}
