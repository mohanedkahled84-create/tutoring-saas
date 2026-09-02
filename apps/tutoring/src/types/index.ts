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
  comment?: string | null;
}

export type NotificationDecisionType = "attendance_absent" | "attendance_present_comment" | "none";

export interface AttendanceEvaluation {
  student_id: string;
  attended: boolean;
  comment?: string | null;
  idempotency_key: string;
  decision: NotificationDecisionType;
  recipient_phone?: string;
  student_name?: string;
}
