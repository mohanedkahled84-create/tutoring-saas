import { SupabaseClient } from "@supabase/supabase-js";
import {
  IAttendanceRepository,
  StudentProfile,
  AttendanceRecord,
} from "./types.js";

export class SupabaseAttendanceRepository implements IAttendanceRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findStudent(
    tenantId: string,
    studentId?: string,
    studentCode?: string
  ): Promise<StudentProfile | null> {
    let studentQuery = this.supabase
      .from("students")
      .select("id, name, student_code, parent_phone, student_phone, fee_override, exempt")
      .eq("tenant_id", tenantId);

    if (studentId) {
      studentQuery = studentQuery.eq("id", studentId);
    } else if (studentCode) {
      studentQuery = studentQuery.eq("student_code", studentCode);
    } else {
      return null;
    }

    const { data, error } = await studentQuery.single();
    if (error || !data) {
      return null;
    }

    return data as StudentProfile;
  }

  async findAttendanceByKey(idempotencyKey: string): Promise<AttendanceRecord | null> {
    const { data } = await this.supabase
      .from("attendance")
      .select("id, tenant_id, session_id, student_id, attended, comment, homework_status, is_makeup, home_group_id, sent, idempotency_key, created_at")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    return (data as unknown as AttendanceRecord) || null;
  }

  async createAttendanceRecord(record: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const { data, error } = await this.supabase
      .from("attendance")
      .insert(record)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to record attendance");
    }

    return data as unknown as AttendanceRecord;
  }

  async upsertAttendanceBatch(
    records: Partial<AttendanceRecord>[]
  ): Promise<AttendanceRecord[]> {
    const { data, error } = await this.supabase
      .from("attendance")
      .upsert(records, { onConflict: "idempotency_key" })
      .select();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to save batch attendance");
    }

    return data as unknown as AttendanceRecord[];
  }

  async getStudentsByIds(
    tenantId: string,
    studentIds: string[]
  ): Promise<Array<{ id: string; name: string; parent_phone: string }>> {
    if (studentIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("students")
      .select("id, name, parent_phone")
      .eq("tenant_id", tenantId)
      .in("id", studentIds);

    if (error || !data) {
      return [];
    }

    return data as Array<{ id: string; name: string; parent_phone: string }>;
  }

  async getAttendanceForSession(sessionId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await this.supabase
      .from("attendance")
      .select(
        "id, tenant_id, session_id, student_id, attended, comment, homework_status, is_makeup, home_group_id, sent, idempotency_key, created_at, students(id, name, parent_phone, student_code)"
      )
      .eq("session_id", sessionId);

    if (error || !data) {
      return [];
    }

    return data as unknown as AttendanceRecord[];
  }

  async getAttendanceWithStudentsForSession(
    sessionId: string
  ): Promise<import("./types.js").AttendanceRecordWithStudent[]> {
    const { data, error } = await this.supabase
      .from("attendance")
      .select(
        "id, tenant_id, session_id, student_id, attended, comment, homework_status, is_makeup, home_group_id, sent, wa_status, idempotency_key, created_at, students(id, name, parent_phone, student_code, student_phone, fee_override, exempt)"
      )
      .eq("session_id", sessionId);

    if (error || !data) {
      return [];
    }

    return data as unknown as import("./types.js").AttendanceRecordWithStudent[];
  }

  async updateAttendanceStatus(
    id: string,
    updates: { sent?: boolean; wa_status?: string }
  ): Promise<void> {
    const { error } = await this.supabase
      .from("attendance")
      .update(updates)
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  }

  async getMessageLogsForTenant(
    tenantId: string
  ): Promise<Array<{ idempotency_key: string; status: string; error_detail?: string | null; created_at: string }>> {
    const { data, error } = await this.supabase
      .from("message_logs")
      .select("idempotency_key, status, error_detail, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data;
  }
}
