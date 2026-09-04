export type ActivityActionType =
  | "attendance_record"
  | "attendance_edit"
  | "session_open"
  | "session_close"
  | "quiz_score_record";

export type ActivityEntityType = "attendance" | "session" | "quiz_score";

export interface ActivityLogEntry {
  tenant_id: string;
  actor_user_id?: string | null;
  action_type: ActivityActionType;
  entity_type: ActivityEntityType;
  entity_id: string;
  before_value?: unknown;
  after_value?: unknown;
}

export interface ActivityLogItem {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  actor_email: string;
  before_value: unknown;
  after_value: unknown;
  created_at: string;
}

export interface ActivityLogFilter {
  entity_type?: string;
  action_type?: string;
  limit?: number;
  offset?: number;
}

export interface IActivityLogRepository {
  insertLog(entry: ActivityLogEntry): Promise<void>;
  getLogs(
    tenantId: string,
    filter: ActivityLogFilter
  ): Promise<{ logs: ActivityLogItem[]; total: number }>;
}
