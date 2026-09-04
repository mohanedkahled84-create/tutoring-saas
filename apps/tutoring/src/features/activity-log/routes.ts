import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../types/index.js";
import { getServices } from "../../composition.js";
import { ActivityLogService } from "./service.js";

export const activityLogsRouter = Router();

function resolveActivityService(req: AuthenticatedRequest): ActivityLogService {
  const services = getServices(req);
  return services.activityLog as ActivityLogService;
}

// DEV-AT.2: Activity Log is restricted to owner and admin roles only; assistants are blocked
activityLogsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userRole = req.user?.role;
  const tenantId = req.user?.tenant_id;

  if (!tenantId && userRole !== "admin") {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "No active tenant context",
      },
    });
    return;
  }

  const { entity_type, action_type, limit = "50", offset = "0" } = req.query;

  try {
    const service = resolveActivityService(req);
    const result = await service.getAuditLogs(tenantId || "", userRole, {
      entity_type: typeof entity_type === "string" ? entity_type : undefined,
      action_type: typeof action_type === "string" ? action_type : undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    res.json(result);
  } catch (err: unknown) {
    const errorMsg = (err as Error).message;
    if (errorMsg === "FORBIDDEN_ASSISTANT") {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Assistants are not permitted to view the audit log.",
        },
      });
      return;
    }

    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to query activity logs", details: errorMsg },
    });
  }
});
