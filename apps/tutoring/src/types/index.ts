import { Request } from "express";
import { SupabaseClient } from "@supabase/supabase-js";

export interface UserContext {
  id: string;
  email?: string;
  tenant_id: string | null;
  role: "admin" | "owner";
}

export interface AuthenticatedRequest extends Request {
  user?: UserContext;
  supabase?: SupabaseClient;
  token?: string;
}

export interface AttendanceRecordInput {
  student_id: string;
  attended: boolean;
  homework_status?: "done" | "partial" | "missing";
  is_makeup?: boolean;
  comment?: string | null;
  quiz_score?: number | null;
  quiz_max_score?: number;
  checkin_time?: string | null;
  wa_status?: "pending" | "queued" | "sent" | "failed";
  quiz_wa_status?: "pending" | "queued" | "sent" | "failed";
}

export type NotificationDecisionType = 
  | "attendance_absent" 
  | "attendance_present_comment" 
  | "attendance_present_checkin"
  | "quiz_result"
  | "quiz_absent_inquiry"
  | "none";

export interface AttendanceEvaluation {
  student_id: string;
  attended: boolean;
  comment?: string | null;
  quiz_score?: number | null;
  idempotency_key: string;
  decision: NotificationDecisionType;
  recipient_phone?: string;
  student_name?: string;
  wa_status?: "pending" | "queued" | "sent" | "failed";
}

export interface SessionFinancialSummary {
  session_id: string;
  total_enrolled: number;
  total_present: number;
  total_absent: number;
  session_price: number;
  total_revenue: number;
  center_cut_percentage: number;
  center_amount: number;
  teacher_cut_percentage: number;
  teacher_amount: number;
}
