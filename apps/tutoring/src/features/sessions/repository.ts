import { SupabaseClient } from "@supabase/supabase-js";
import {
  ISessionsRepository,
  CreateSessionInput,
  CreateExtraSessionInput,
  SessionModel,
  SessionStatus,
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
    status: SessionStatus,
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

  async cancelSession(sessionId: string, reason?: string): Promise<SessionModel> {
    const { data, error } = await this.supabase
      .from("sessions")
      .update({
        status: "cancelled",
        cancellation_reason: reason || null,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to cancel session");
    }
    return data as unknown as SessionModel;
  }

  async rescheduleSession(
    sessionId: string,
    newDate: string,
    newTime?: string,
    reason?: string
  ): Promise<SessionModel> {
    const { data, error } = await this.supabase
      .from("sessions")
      .update({
        status: "rescheduled",
        rescheduled_to_date: newDate,
        rescheduled_to_time: newTime || null,
        cancellation_reason: reason || null,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to reschedule session");
    }
    return data as unknown as SessionModel;
  }

  async getNextSessionNumber(groupId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("sessions")
      .select("session_number")
      .eq("group_id", groupId)
      .order("session_number", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return 1;
    }
    return ((data[0] as { session_number: number }).session_number || 0) + 1;
  }

  async createExtraSession(
    tenantId: string,
    input: CreateExtraSessionInput,
    nextSessionNumber: number
  ): Promise<SessionModel> {
    const { data, error } = await this.supabase
      .from("sessions")
      .insert({
        tenant_id: tenantId,
        group_id: input.group_id,
        session_number: nextSessionNumber,
        session_date: input.session_date,
        is_extra: true,
        extra_topic: input.topic || null,
        status: "scheduled",
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to create extra session");
    }
    return data as unknown as SessionModel;
  }

  async getStudentsForGroup(
    groupId: string
  ): Promise<Array<{ id: string; name: string; parent_phone: string }>> {
    const { data, error } = await this.supabase
      .from("group_students")
      .select("student_id, students(id, name, parent_phone)")
      .eq("group_id", groupId);

    if (error || !data) {
      return [];
    }

    return (data as unknown as Array<{ students: { id: string; name: string; parent_phone: string } }>)
      .map((row) => row.students)
      .filter((s) => Boolean(s && s.id));
  }

  async logSessionActionNotification(
    tenantId: string,
    idempotencyKey: string,
    phone: string,
    messageType: string,
    content: string
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("message_logs")
      .insert({
        tenant_id: tenantId,
        idempotency_key: idempotencyKey,
        message_type: messageType,
        recipient_type: "parent",
        recipient_phone: phone,
        status: "queued",
        error_detail: content,
      })
      .select("id")
      .single();

    if (error || !data) {
      return null;
    }
    return data.id;
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

  async getSessionsByDateRange(
    tenantId: string,
    fromDate: string,
    toDate: string
  ): Promise<SessionModel[]> {
    const { data, error } = await this.supabase
      .from("sessions")
      .select(
        "id, tenant_id, group_id, session_number, session_date, status, is_extra, extra_topic, rescheduled_to_date, rescheduled_to_time, cancellation_reason, created_at, groups(id, name, center_name, price)"
      )
      .eq("tenant_id", tenantId)
      .gte("session_date", fromDate)
      .lte("session_date", toDate)
      .order("session_date", { ascending: true })
      .order("session_number", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data as unknown as SessionModel[];
  }
}
