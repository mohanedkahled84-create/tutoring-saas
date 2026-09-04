import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";

export const activityLogsRouter = Router();

// DEV-AT.2: Activity Log is restricted to owner and admin roles only; assistants are blocked
activityLogsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userRole = req.user?.role;
  if (userRole === "assistant") {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Assistants are not permitted to view the audit log.",
      },
    });
    return;
  }

  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;
  const { entity_type, action_type, limit = "50", offset = "0" } = req.query;

  try {
    let query = supabase
      .from("activity_logs")
      .select(
        "id, tenant_id, actor_user_id, action_type, entity_type, entity_id, before_value, after_value, created_at, users(email)",
        {
          count: "exact",
        }
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(
        parseInt(offset as string, 10),
        parseInt(offset as string, 10) + parseInt(limit as string, 10) - 1
      );

    if (entity_type && typeof entity_type === "string") {
      query = query.eq("entity_type", entity_type);
    }
    if (action_type && typeof action_type === "string") {
      query = query.eq("action_type", action_type);
    }

    const { data: logs, count, error } = await query;

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({
      total: count || 0,
      logs: (logs || []).map((l: Record<string, unknown>) => ({
        id: l.id,
        action_type: l.action_type,
        entity_type: l.entity_type,
        entity_id: l.entity_id,
        actor_email: (l.users as { email?: string } | null)?.email || "Unknown",
        before_value: typeof l.before_value === "string" ? JSON.parse(l.before_value) : null,
        after_value: typeof l.after_value === "string" ? JSON.parse(l.after_value) : null,
        created_at: l.created_at,
      })),
    });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Failed to query activity logs" } });
  }
});
