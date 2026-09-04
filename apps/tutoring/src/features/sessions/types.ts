export interface CreateSessionInput {
  group_id: string;
  session_number: number;
  session_date: string;
}

export type SessionStatus = "scheduled" | "in_progress" | "ended" | "cancelled" | "rescheduled";

export interface SessionModel {
  id: string;
  tenant_id: string;
  group_id: string;
  session_number: number;
  session_date: string;
  created_at: string;
  status?: SessionStatus;
  ended_at?: string | null;
  is_extra?: boolean;
  rescheduled_to_date?: string | null;
  rescheduled_to_time?: string | null;
  cancellation_reason?: string | null;
  extra_topic?: string | null;
  groups?: {
    id?: string;
    name?: string;
    center_name?: string;
    price?: number | string;
    billing_model?: string;
    fixed_rent_amount?: number | string;
  } | null;
}

export interface CancelSessionInput {
  reason?: string;
  notify_parents?: boolean;
}

export interface RescheduleSessionInput {
  new_date: string;
  new_time?: string;
  reason?: string;
  notify_parents?: boolean;
}

export interface CreateExtraSessionInput {
  group_id: string;
  session_date: string;
  session_time?: string;
  topic?: string;
  notify_parents?: boolean;
}

export interface SessionActionResult {
  session: SessionModel;
  action: "cancelled" | "rescheduled" | "extra";
  notifications_dispatched: number;
  message: string;
  details?: {
    cancellation_reason?: string;
    new_date?: string;
    new_time?: string;
    extra_topic?: string;
  };
}

export interface GroupFinancialData {
  id?: string;
  name?: string;
  center_name?: string;
  price?: number | string;
  billing_model?: string;
  fixed_rent_amount?: number | string;
}

export interface AttendeeFinancialData {
  id: string;
  student_id: string;
  attended: boolean;
  is_makeup?: boolean;
  home_group_id?: string | null;
  students?: {
    id: string;
    name: string;
    fee_override?: number | null;
    exempt?: boolean | null;
  } | null;
}

export interface FinancialBreakdownItem {
  student_id?: string;
  student_name?: string;
  is_makeup?: boolean;
  home_group_id?: string | null;
  pricing_type: string;
  fee_charged: number;
}

export interface FinancialSummaryResult {
  session_id: string;
  group: {
    id?: string;
    name?: string;
    base_price: number;
    billing_model?: string;
    fixed_rent_amount?: number | string;
  };
  financials: {
    total_revenue: number;
    attendee_count: number;
    regular_count: number;
    exempt_count: number;
    overridden_count: number;
    makeup_count: number;
  };
  breakdown: FinancialBreakdownItem[];
}

export interface ReceiptOptions {
  recipient_phone?: string;
  recipient_type?: string;
  send_via_whatsapp?: boolean;
}

export interface ReceiptSummary {
  session_id: string;
  group_name?: string;
  present_count: number;
  absent_count: number;
  exempt_count: number;
  makeup_count: number;
  total_revenue: number;
  center_share: number;
  teacher_share: number;
}

export interface ReceiptResult {
  message: string;
  formatted_receipt: string;
  summary: ReceiptSummary;
  logged_message_id?: string | null;
}

export interface QuizScoreRecord {
  id?: string;
  tenant_id?: string;
  session_id: string;
  student_id: string;
  score: number;
  max_score: number;
  idempotency_key?: string;
  created_at?: string;
  updated_at?: string;
  students?: {
    name?: string;
    student_code?: string;
  } | null;
}

export interface ISessionsRepository {
  createSession(tenantId: string, input: CreateSessionInput): Promise<SessionModel>;
  getSessionWithDetails(sessionId: string): Promise<{
    session: SessionModel;
    attendance: unknown[];
    quiz_scores: unknown[];
  } | null>;
  getSessionWithGroup(sessionId: string): Promise<{
    session: SessionModel;
    group: GroupFinancialData;
  } | null>;
  getAttendedStudentsForSession(sessionId: string): Promise<AttendeeFinancialData[]>;
  getAllAttendanceWithStudents(sessionId: string): Promise<AttendeeFinancialData[]>;
  upsertQuizScore(
    tenantId: string,
    sessionId: string,
    studentId: string,
    score: number,
    maxScore: number
  ): Promise<QuizScoreRecord>;
  getQuizScoresForSession(sessionId: string): Promise<QuizScoreRecord[]>;
  updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    endedAt?: string | null
  ): Promise<SessionModel>;
  cancelSession(sessionId: string, reason?: string): Promise<SessionModel>;
  rescheduleSession(
    sessionId: string,
    newDate: string,
    newTime?: string,
    reason?: string
  ): Promise<SessionModel>;
  createExtraSession(
    tenantId: string,
    input: CreateExtraSessionInput,
    nextSessionNumber: number
  ): Promise<SessionModel>;
  getStudentsForGroup(
    groupId: string
  ): Promise<Array<{ id: string; name: string; parent_phone: string }>>;
  logSessionActionNotification(
    tenantId: string,
    idempotencyKey: string,
    phone: string,
    messageType: string,
    content: string
  ): Promise<string | null>;
  getNextSessionNumber(groupId: string): Promise<number>;
  logReceiptMessage(
    tenantId: string,
    idempotencyKey: string,
    recipientType: string,
    recipientPhone: string,
    formattedReceipt: string
  ): Promise<string | null>;
}
