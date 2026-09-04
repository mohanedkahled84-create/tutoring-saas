import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger.js";

export interface ActivityLogEntry {
  tenant_id: string;
  actor_user_id?: string | null;
  action_type:
    | "attendance_record"
    | "attendance_edit"
    | "session_open"
    | "session_close"
    | "quiz_score_record";
  entity_type: "attendance" | "session" | "quiz_score";
  entity_id: string;
  before_value?: any;
  after_value?: any;
}

export async function logActivity(
  supabase: SupabaseClient,
  entry: ActivityLogEntry
): Promise<void> {
  try {
    const { error } = await supabase.from("activity_logs").insert({
      tenant_id: entry.tenant_id,
      actor_user_id: entry.actor_user_id || null,
      action_type: entry.action_type,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      before_value: entry.before_value ? JSON.stringify(entry.before_value) : null,
      after_value: entry.after_value ? JSON.stringify(entry.after_value) : null,
    });

    if (error) {
      logger.warn(`[ActivityLogger] Failed to write activity log: ${error.message}`);
    }
  } catch (err: any) {
    logger.error("[ActivityLogger] Error logging activity", err);
  }
}
