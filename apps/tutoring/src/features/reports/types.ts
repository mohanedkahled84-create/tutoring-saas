export interface StudentRawPerformanceData {
  student: {
    id: string;
    name: string;
    code: string;
    parent_phone: string;
    student_phone?: string | null;
    group_id?: string | null;
    group_name?: string | null;
  };
  attendances: Array<{
    attended: boolean;
    session_id?: string;
    date?: string;
  }>;
  grades: Array<{
    score: number;
    max_score: number;
    quiz_title?: string;
    date?: string;
  }>;
}

export interface StudentPerformanceRecord {
  student_id: string;
  student_name: string;
  student_code: string;
  parent_phone: string;
  student_phone?: string | null;
  group_id?: string | null;
  group_name?: string | null;
  total_sessions: number;
  attended_sessions: number;
  absent_sessions: number;
  attendance_rate: number; // 0 - 100 %
  total_quizzes: number;
  average_score: number; // 0 - 100 %
  overall_score: number;
  rank: number;
}

export interface MonthlyReportSummary {
  tenant_id: string;
  period: {
    month: number;
    year: number;
    start_date?: string;
    end_date?: string;
  };
  leaderboard: StudentPerformanceRecord[];
  total_students: number;
  average_attendance_rate: number;
  average_score: number;
}

export interface ReportSendResult {
  student_id: string;
  student_name: string;
  recipient_phone: string;
  status: "queued" | "sent" | "failed" | "skipped";
  mode: "bulk" | "individual";
  idempotency_key: string;
  error_detail?: string;
}

export interface BulkSendSummary {
  total_students: number;
  queued_count: number;
  skipped_count: number;
  failed_count: number;
  results: ReportSendResult[];
}

export interface IReportsRepository {
  getStudentsWithPerformanceData(
    tenantId: string,
    month: number,
    year: number,
    groupId?: string
  ): Promise<StudentRawPerformanceData[]>;

  getStudentPerformanceData(
    tenantId: string,
    studentId: string,
    month: number,
    year: number
  ): Promise<StudentRawPerformanceData | null>;
}
