import { logger } from "../../shared/utils/logger.js";
import {
  IActivityLogRepository,
  ActivityLogEntry,
  ActivityLogFilter,
  ActivityLogItem,
} from "./types.js";

export class ActivityLogService {
  constructor(private readonly repository: IActivityLogRepository) {}

  /**
   * Records an audit activity log entry safely without throwing errors to the caller.
   */
  async recordActivity(entry: ActivityLogEntry): Promise<void> {
    try {
      await this.repository.insertLog(entry);
    } catch (err: unknown) {
      logger.warn(
        `[ActivityLogService] Failed to record activity log for ${entry.entity_type}:${entry.entity_id} - ${(err as Error).message}`
      );
    }
  }

  /**
   * Queries audit logs with pagination and role-based access control.
   * Assistants are strictly forbidden from viewing audit logs.
   */
  async getAuditLogs(
    tenantId: string,
    userRole: string | undefined,
    filter: ActivityLogFilter
  ): Promise<{ logs: ActivityLogItem[]; total: number }> {
    if (userRole === "assistant") {
      throw new Error("FORBIDDEN_ASSISTANT");
    }

    return this.repository.getLogs(tenantId, filter);
  }
}
