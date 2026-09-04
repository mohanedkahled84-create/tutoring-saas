import { SupabaseClient } from "@supabase/supabase-js";
import {
  IActivityLogRepository,
  ActivityLogEntry,
  ActivityLogItem,
  ActivityLogFilter,
} from "./types.js";

export class SupabaseActivityLogRepository implements IActivityLogRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async insertLog(entry: ActivityLogEntry): Promise<void> {
    const { error } = await this.supabase.from("activity_logs").insert({
      tenant_id: entry.tenant_id,
      actor_user_id: entry.actor_user_id || null,
      action_type: entry.action_type,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      before_value: entry.before_value ? JSON.stringify(entry.before_value) : null,
      after_value: entry.after_value ? JSON.stringify(entry.after_value) : null,
    });

    if (error) {
      throw new Error(`Failed to insert activity log: ${error.message}`);
    }
  }

  async getLogs(
    tenantId: string,
    filter: ActivityLogFilter
  ): Promise<{ logs: ActivityLogItem[]; total: number }> {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    let query = this.supabase
      .from("activity_logs")
      .select(
        "id, tenant_id, actor_user_id, action_type, entity_type, entity_id, before_value, after_value, created_at, users(email)",
        {
          count: "exact",
        }
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter.entity_type) {
      query = query.eq("entity_type", filter.entity_type);
    }
    if (filter.action_type) {
      query = query.eq("action_type", filter.action_type);
    }

    const { data: logs, count, error } = await query;

    if (error) {
      throw new Error(`Failed to query activity logs: ${error.message}`);
    }

    const items: ActivityLogItem[] = (logs || []).map((l: Record<string, unknown>) => {
      const userData = l.users as { email?: string } | null;
      let parsedBefore: unknown = null;
      let parsedAfter: unknown = null;

      if (typeof l.before_value === "string") {
        try {
          parsedBefore = JSON.parse(l.before_value);
        } catch {
          parsedBefore = l.before_value;
        }
      }
      if (typeof l.after_value === "string") {
        try {
          parsedAfter = JSON.parse(l.after_value);
        } catch {
          parsedAfter = l.after_value;
        }
      }

      return {
        id: String(l.id),
        action_type: String(l.action_type),
        entity_type: String(l.entity_type),
        entity_id: String(l.entity_id),
        actor_email: userData?.email || "Unknown",
        before_value: parsedBefore,
        after_value: parsedAfter,
        created_at: String(l.created_at),
      };
    });

    return {
      logs: items,
      total: count || 0,
    };
  }
}
