import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../types/index.js";
import { validateBody } from "../../middleware/validation.js";
import { getServices } from "../../composition.js";
import { RiskWatchlistService } from "./service.js";
import { AlertType } from "./types.js";

export const riskRouter = Router();

// Schema for sending tailored at-risk alert
const sendAlertSchema = z.object({
  alert_type: z.enum(["absence_warning", "grade_drop", "homework_neglect", "parent_meeting"]),
  custom_message: z.string().max(500).optional().nullable(),
});

function resolveRiskService(req: AuthenticatedRequest): RiskWatchlistService {
  const services = getServices(req);
  return services.riskWatchlist as RiskWatchlistService;
}

// DEV-ARW.1: GET /api/at-risk/watchlist - Compute on-demand watchlist
riskRouter.get("/watchlist", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { group_id } = req.query;

  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const service = resolveRiskService(req);
    const watchlist = await service.computeWatchlist(
      tenantId || "",
      group_id as string | undefined
    );

    res.json({
      timestamp: new Date().toISOString(),
      total_at_risk: watchlist.length,
      high_severity_count: watchlist.filter((s) => s.severity === "high").length,
      watchlist,
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Risk computation failed", details: (err as Error).message },
    });
  }
});

// DEV-ARW.2: POST /api/at-risk/alerts/:student_id - Trigger tailored alert
riskRouter.post(
  "/alerts/:student_id",
  validateBody(sendAlertSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { student_id } = req.params;
    const { alert_type, custom_message } = req.body;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveRiskService(req);
      const alert = await service.queueAlert(
        tenantId || "",
        student_id,
        alert_type as AlertType,
        custom_message
      );

      res.status(200).json({
        message: "At-risk alert queued successfully",
        alert,
      });
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      if (errorMsg === "STUDENT_NOT_FOUND") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found" } });
        return;
      }
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to queue alert", details: errorMsg } });
    }
  }
);
