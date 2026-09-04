import { SupabaseClient } from "@supabase/supabase-js";
import {
  IRiskWatchlistRepository,
  StudentRiskProfile,
  SessionRiskData,
  AttendanceRiskRecord,
  QuizScoreRiskRecord,
  QueuedAlertRecord,
} from "./types.js";

// Re-export interface for ease of consumers
export type { IRiskWatchlistRepository };

export class SupabaseRiskWatchlistRepository implements IRiskWatchlistRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getStudents(tenantId: string): Promise<StudentRiskProfile[]> {
    const { data, error } = await this.supabase
      .from("students")
      .select("id, name, student_code, parent_phone, tenant_id")
      .eq("tenant_id", tenantId);

    if (error || !data) {
      return [];
    }

    return data.map((s) => ({
      id: s.id,
      name: s.name,
      student_code: s.student_code,
      parent_phone: s.parent_phone,
      tenant_id: s.tenant_id,
    }));
  }

  async getRecentSessions(
    tenantId: string,
    groupId?: string,
    limit = 15
  ): Promise<SessionRiskData[]> {
    let query = this.supabase
      .from("sessions")
      .select("id, group_id, session_number, session_date, groups(name)")
      .eq("tenant_id", tenantId)
      .order("session_date", { ascending: false })
      .limit(limit);

    if (groupId) {
      query = query.eq("group_id", groupId);
    }

    const { data } = await query;
    if (!data || data.length === 0) {
      return [];
    }

    return data.map((s) => {
      const groupData = s.groups as unknown as { name?: string } | { name?: string }[] | null;
      const groupName = Array.isArray(groupData)
        ? groupData[0]?.name
        : groupData?.name;

      return {
        id: s.id,
        group_id: s.group_id,
        session_number: s.session_number,
        session_date: s.session_date,
        group_name: groupName,
      };
    });
  }

  async getAttendanceForSessions(sessionIds: string[]): Promise<AttendanceRiskRecord[]> {
    if (sessionIds.length === 0) {
      return [];
    }

    const { data } = await this.supabase
      .from("attendance")
      .select("id, session_id, student_id, attended, homework_status, created_at")
      .in("session_id", sessionIds);

    if (!data) {
      return [];
    }

    return data.map((a) => ({
      id: a.id,
      session_id: a.session_id,
      student_id: a.student_id,
      attended: a.attended,
      homework_status: a.homework_status,
      created_at: a.created_at,
    }));
  }

  async getQuizScoresForStudents(studentIds: string[]): Promise<QuizScoreRiskRecord[]> {
    if (studentIds.length === 0) {
      return [];
    }

    const { data } = await this.supabase
      .from("quiz_scores")
      .select("student_id, session_id, score, max_score, created_at")
      .in("student_id", studentIds)
      .order("created_at", { ascending: false });

    if (!data) {
      return [];
    }

    return data.map((q) => ({
      student_id: q.student_id,
      session_id: q.session_id,
      score: Number(q.score),
      max_score: Number(q.max_score),
      created_at: q.created_at,
    }));
  }

  async getStudentById(
    tenantId: string,
    studentId: string
  ): Promise<StudentRiskProfile | null> {
    const { data, error } = await this.supabase
      .from("students")
      .select("id, name, student_code, parent_phone, tenant_id")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      student_code: data.student_code,
      parent_phone: data.parent_phone,
      tenant_id: data.tenant_id,
    };
  }

  async upsertAlertLog(entry: QueuedAlertRecord): Promise<{ status: string }> {
    const { data, error } = await this.supabase
      .from("message_logs")
      .upsert(
        {
          tenant_id: entry.tenant_id,
          student_id: entry.student_id,
          idempotency_key: entry.idempotency_key,
          message_type: entry.message_type,
          recipient_type: entry.recipient_type,
          recipient_phone: entry.recipient_phone,
          status: entry.status,
          error_detail: entry.error_detail || null,
        },
        { onConflict: "idempotency_key" }
      )
      .select("status")
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to record message log");
    }

    return { status: data.status };
  }
}
