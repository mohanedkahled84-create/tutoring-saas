export type RiskCategory = "absence_warning" | "grade_drop" | "homework_neglect";

export type AlertType =
  | "absence_warning"
  | "grade_drop"
  | "homework_neglect"
  | "parent_meeting";

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

export interface StudentRiskProfile {
  id: string;
  name: string;
  student_code?: string | null;
  parent_phone: string;
  tenant_id: string;
}

export interface SessionRiskData {
  id: string;
  group_id?: string;
  session_number?: number;
  session_date?: string;
  group_name?: string;
}

export interface AttendanceRiskRecord {
  id: string;
  session_id: string;
  student_id: string;
  attended: boolean;
  homework_status?: "done" | "partial" | "missing" | null;
  created_at: string;
}

export interface QuizScoreRiskRecord {
  student_id: string;
  session_id: string;
  score: number;
  max_score: number;
  created_at: string;
}

export interface QueuedAlertRecord {
  tenant_id: string;
  student_id: string;
  idempotency_key: string;
  message_type: AlertType;
  recipient_type: "parent";
  recipient_phone: string;
  status: string;
  error_detail?: string | null;
}

export interface QueuedAlertResult {
  student_id: string;
  student_name: string;
  recipient_phone: string;
  alert_type: AlertType;
  idempotency_key: string;
  status: string;
}

export interface IRiskWatchlistRepository {
  getStudents(tenantId: string): Promise<StudentRiskProfile[]>;
  getRecentSessions(
    tenantId: string,
    groupId?: string,
    limit?: number
  ): Promise<SessionRiskData[]>;
  getAttendanceForSessions(sessionIds: string[]): Promise<AttendanceRiskRecord[]>;
  getQuizScoresForStudents(studentIds: string[]): Promise<QuizScoreRiskRecord[]>;
  getStudentById(tenantId: string, studentId: string): Promise<StudentRiskProfile | null>;
  upsertAlertLog(entry: QueuedAlertRecord): Promise<{ status: string }>;
}
