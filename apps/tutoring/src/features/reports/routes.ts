import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServices } from "../../composition.js";
import { ReportsService } from "./service.js";

export const reportsRouter = Router();

function resolveReportsService(req: AuthenticatedRequest): ReportsService {
  const services = getServices(req);
  return services.reports;
}

// GET /api/reports/monthly - Retrieve ranked performance leaderboard and summary
reportsRouter.get("/monthly", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  const now = new Date();
  const month = req.query.month ? parseInt(String(req.query.month), 10) : now.getMonth() + 1;
  const year = req.query.year ? parseInt(String(req.query.year), 10) : now.getFullYear();
  const groupId = req.query.group_id ? String(req.query.group_id) : undefined;
  const q = req.query.q ? String(req.query.q) : undefined;

  try {
    const service = resolveReportsService(req);
    const summary = await service.getMonthlyLeaderboard(tenantId, month, year, groupId, q);
    res.json(summary);
  } catch (err: unknown) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: (err as Error).message },
    });
  }
});

// Old clients must not silently dispatch reports after the manual WhatsApp decision.
const manualHandoffRequired = (_req: AuthenticatedRequest, res: Response): void => {
 res.status(410).json({error:{code:'MANUAL_WHATSAPP_REQUIRED',message:'افتح تقرير المتابعة ثم راجع الرسالة وأرسلها بنفسك من واتساب'}});
};
reportsRouter.post('/bulk-send',manualHandoffRequired);
reportsRouter.post('/:student_id/send',manualHandoffRequired);
