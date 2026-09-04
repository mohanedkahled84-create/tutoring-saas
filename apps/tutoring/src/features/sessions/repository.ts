import { SupabaseClient } from "@supabase/supabase-js";
import {
  ISessionsRepository,
  CreateSessionInput,
  SessionModel,
  GroupFinancialData,
  AttendeeFinancialData,
  QuizScoreRecord,
} from "./types.js";

export class SupabaseSessionsRepository implements ISessionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createSession(tenantId: string, input: CreateSessionInput): Promise<SessionModel> {
    const { data, error } = await this.supabase
      .from("sessions")
      .insert({
        tenant_id: tenantId,
        group_id: input.group_id,
        session_number: input.session_number,
        session_date: input.session_date,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to create session");
    }

    return data as unknown as SessionModel;
  }

  async updateSessionStatus(
    sessionId: string,
    status: "in_progress" | "ended" | "cancelled",
    endedAt?: string | null
  ): Promise<SessionModel> {
    const updatePayload: Record<string, unknown> = { status };
    if (endedAt !== undefined) {
      updatePayload.ended_at = endedAt;
    }

    const { data, error } = await this.supabase
      .from("sessions")
      .update(updatePayload)
      .eq("id", sessionId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to update session status");
    }

    return data as unknown as SessionModel;
  }

  async getSessionWithDetails(sessionId: string): Promise<{
    session: SessionModel;
    attendance: unknown[];
    quiz_scores: unknown[];
  } | null> {
    const { data: session, error: sessionError } = await this.supabase
      .from("sessions")
      .select(
        "id, tenant_id, group_id, session_number, session_date, created_at, groups(name, price, billing_model)"
      )
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return null;
    }

    const [attendanceRes, quizRes] = await Promise.all([
      this.supabase
        .from("attendance")
        .select(
          "id, student_id, attended, comment, homework_status, is_makeup, home_group_id, sent, idempotency_key, created_at, students(id, name, student_code, parent_phone)"
        )
        .eq("session_id", sessionId),
      this.supabase
        .from("quiz_scores")
        .select("id, student_id, score, max_score, created_at")
        .eq("session_id", sessionId),
    ]);

    return {
      session: session as unknown as SessionModel,
      attendance: attendanceRes.data || [],
      quiz_scores: quizRes.data || [],
    };
  }

  async getSessionWithGroup(sessionId: string): Promise<{
    session: SessionModel;
    group: GroupFinancialData;
  } | null> {
    const { data: session, error } = await this.supabase
      .from("sessions")
      .select(
        "id, tenant_id, group_id, session_number, session_date, created_at, groups(id, name, center_name, price, billing_model, fixed_rent_amount)"
      )
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      return null;
    }

    const rawGroup = (
      session as unknown as {
        groups: GroupFinancialData | GroupFinancialData[] | null;
      }
    ).groups;
    const group = Array.isArray(rawGroup) ? rawGroup[0] : (rawGroup || {});

    return {
      session: session as unknown as SessionModel,
      group: group as GroupFinancialData,
    };
  }

  async getAttendedStudentsForSession(sessionId: string): Promise<AttendeeFinancialData[]> {
    const { data, error } = await this.supabase
      .from("attendance")
      .select(
        "id, student_id, attended, is_makeup, home_group_id, students(id, name, fee_override, exempt)"
      )
      .eq("session_id", sessionId)
      .eq("attended", true);

    if (error || !data) {
      return [];
    }

    return data as unknown as AttendeeFinancialData[];
  }

  async getAllAttendanceWithStudents(sessionId: string): Promise<AttendeeFinancialData[]> {
    const { data, error } = await this.supabase
      .from("attendance")
      .select(
        "id, student_id, attended, is_makeup, home_group_id, students(id, name, fee_override, exempt)"
      )
      .eq("session_id", sessionId);

    if (error || !data) {
      return [];
    }

    return data as unknown as AttendeeFinancialData[];
  }

  async upsertQuizScore(
    tenantId: string,
    sessionId: string,
    studentId: string,
    score: number,
    maxScore: number
  ): Promise<QuizScoreRecord> {
    const idempotencyKey = `${tenantId}:${studentId}:${sessionId}`;

    const { data, error } = await this.supabase
      .from("quiz_scores")
      .upsert(
        {
          tenant_id: tenantId,
          session_id: sessionId,
          student_id: studentId,
          score,
          max_score: maxScore,
          idempotency_key: idempotencyKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "idempotency_key" }
      )
      .select()
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to save quiz score");
    }

    return data as unknown as QuizScoreRecord;
  }

  async getQuizScoresForSession(sessionId: string): Promise<QuizScoreRecord[]> {
    const { data, error } = await this.supabase
      .from("quiz_scores")
      .select(
        "id, student_id, score, max_score, created_at, updated_at, students(name, student_code)"
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data as unknown as QuizScoreRecord[];
  }

  async logReceiptMessage(
    tenantId: string,
    idempotencyKey: string,
    recipientType: string,
    recipientPhone: string,
    formattedReceipt: string
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("message_logs")
      .insert({
        tenant_id: tenantId,
        idempotency_key: idempotencyKey,
        message_type: "session_receipt",
        recipient_type: recipientType,
        recipient_phone: recipientPhone,
        status: "needs_review",
        error_detail: formattedReceipt,
      })
      .select("id")
      .single();

    if (error || !data) {
      return null;
    }

    return data.id;
  }
}
