import {
  StudentRawPerformanceData,
  StudentPerformanceRecord,
} from "./types.js";

/**
 * Pure calculation function: calculates attendance %, quiz/grade average, and overall score for a single student.
 * ZERO database / Supabase dependency (Clean Architecture Rule 1 compliant).
 */
export function calculateStudentSummary(raw: StudentRawPerformanceData): StudentPerformanceRecord {
  const { student, attendances = [], grades = [] } = raw;

  const total_sessions = attendances.length;
  const attended_sessions = attendances.filter((a) => a.attended === true).length;
  const absent_sessions = attendances.filter((a) => a.attended === false).length;

  // Attendance rate (percentage 0-100)
  const attendance_rate =
    total_sessions > 0 ? Math.round((attended_sessions / total_sessions) * 100) : 100;

  // Grade/Quiz Average (normalized to 0-100%)
  let totalNormalizedScore = 0;
  let validGradesCount = 0;

  for (const g of grades) {
    if (typeof g.score === "number" && typeof g.max_score === "number" && g.max_score > 0) {
      const normalized = (g.score / g.max_score) * 100;
      totalNormalizedScore += Math.max(0, Math.min(100, normalized));
      validGradesCount++;
    }
  }

  const average_score =
    validGradesCount > 0 ? Math.round((totalNormalizedScore / validGradesCount) * 10) / 10 : 0;

  // Overall performance score: 70% weighted quiz performance + 30% attendance rate
  const overall_score =
    validGradesCount > 0
      ? Math.round((average_score * 0.7 + attendance_rate * 0.3) * 10) / 10
      : attendance_rate;

  return {
    student_id: student.id,
    student_name: student.name,
    student_code: student.code,
    parent_phone: student.parent_phone,
    student_phone: student.student_phone || null,
    group_id: student.group_id || null,
    group_name: student.group_name || null,
    total_sessions,
    attended_sessions,
    absent_sessions,
    attendance_rate,
    total_quizzes: validGradesCount,
    average_score,
    overall_score,
    rank: 0, // Assigned by rankStudents()
  };
}

/**
 * Pure ranking function: sorts students descending by performance and assigns leaderboard ranks.
 * 1. Higher overall_score / average_score first
 * 2. Higher attendance_rate as tie-breaker
 * 3. Student name alphabetically as second tie-breaker
 */
export function rankStudents(students: StudentPerformanceRecord[]): StudentPerformanceRecord[] {
  const sorted = [...students].sort((a, b) => {
    // 1. Overall score
    if (b.overall_score !== a.overall_score) {
      return b.overall_score - a.overall_score;
    }
    // 2. Average quiz score
    if (b.average_score !== a.average_score) {
      return b.average_score - a.average_score;
    }
    // 3. Attendance rate
    if (b.attendance_rate !== a.attendance_rate) {
      return b.attendance_rate - a.attendance_rate;
    }
    // 4. Alphabetical tie breaker
    return a.student_name.localeCompare(b.student_name, "ar");
  });

  return sorted.map((record, index) => ({
    ...record,
    rank: index + 1,
  }));
}

/**
 * Universal search filter helper: searches student list by code/barcode, name, OR phone number.
 */
export function filterStudentsByQuery(
  students: StudentPerformanceRecord[],
  query?: string
): StudentPerformanceRecord[] {
  if (!query || query.trim().length === 0) {
    return students;
  }

  const clean = query.trim().toLowerCase();
  // Normalize Arabic letters and phone numbers for flexible search
  const normalizedQuery = clean.replace(/[+-\s]/g, "");

  return students.filter((s) => {
    const nameMatch = s.student_name.toLowerCase().includes(clean);
    const codeMatch = s.student_code.toLowerCase().includes(clean);
    const parentPhoneClean = (s.parent_phone || "").replace(/[+-\s]/g, "");
    const studentPhoneClean = (s.student_phone || "").replace(/[+-\s]/g, "");

    const phoneMatch =
      parentPhoneClean.includes(normalizedQuery) || studentPhoneClean.includes(normalizedQuery);

    return nameMatch || codeMatch || phoneMatch;
  });
}

/**
 * Formats a localized Arabic WhatsApp report message.
 */
export function formatStudentReportMessage(
  record: StudentPerformanceRecord,
  periodName?: string
): string {
  const periodText = periodName || "الشهر الحالي";
  const rankBadge =
    record.rank === 1
      ? "🥇 الأول"
      : record.rank === 2
        ? "🥈 الثاني"
        : record.rank === 3
          ? "🥉 الثالث"
          : `المركز ${record.rank}`;

  return [
    `📊 *تقرير الأداء والمتابعة الأكاديمية*`,
    `--------------------------------`,
    `عزيزي ولي أمر الطالب: *${record.student_name}*`,
    `كود الطالب: \`${record.student_code}\``,
    `الفترة: ${periodText}`,
    record.group_name ? `المجموعة: ${record.group_name}` : null,
    ``,
    `📈 *ملخص الحضور والغياب:*`,
    `• إجمالي الحصص: ${record.total_sessions}`,
    `• عدد مرات الحضور: ${record.attended_sessions}`,
    `• عدد مرات الغياب: ${record.absent_sessions}`,
    `• نسبة الالتزام بالحضور: ${record.attendance_rate}%`,
    ``,
    `📝 *التقييم والدرجات:*`,
    `• عدد الاختبارات / الكويزات: ${record.total_quizzes}`,
    `• متوسط الدرجات: ${record.average_score}%`,
    `• الترتيب في لوحة التميز: *${rankBadge}*`,
    `• التقييم العام: ${record.overall_score}%`,
    ``,
    `--------------------------------`,
    `نتمنى لطلابنا دوام التوفيق والتميز الدراسي! ✨`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
