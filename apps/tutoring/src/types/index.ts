import { Request } from "express";
import { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "admin" | "owner" | "assistant";

export interface UserContext {
  id: string;
  email?: string;
  tenant_id: string | null;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: UserContext;
  supabase?: SupabaseClient;
  token?: string;
}

export interface AttendanceRecordInput {
  student_id: string;
  attended: boolean;
  comment?: string | null;
  homework_status?: "done" | "partial" | "missing" | null;
  is_makeup?: boolean;
  home_group_id?: string | null;
}

export interface QuizScoreInput {
  score: number;
  max_score: number;
}

export type NotificationDecisionType = "attendance_absent" | "attendance_present_comment" | "none";

export interface AttendanceEvaluation {
  student_id: string;
  attended: boolean;
  comment?: string | null;
  homework_status?: "done" | "partial" | "missing" | null;
  is_makeup?: boolean;
  home_group_id?: string | null;
  idempotency_key: string;
  decision: NotificationDecisionType;
  recipient_phone?: string;
  student_name?: string;
}
export interface OfflineAttendanceWrite {
  idempotency_key: string;
  student_id: string;
  session_id: string;
  attended: boolean;
  comment?: string | null;
  homework_status?: "done" | "partial" | "missing" | null;
  is_makeup?: boolean;
  home_group_id?: string | null;
  client_timestamp?: string;
}
