import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServices } from "../../composition.js";
import { ReportsService } from "./service.js";

export const reportsRouter = Router();

function resolveReportsService(req: AuthenticatedRequest): ReportsService {
  const services = getServices(req);
  return (services as any).reports as ReportsService;
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

// POST /api/reports/bulk-send - Bulk dispatch reports to all parents via pacing queue
reportsRouter.post("/bulk-send", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  const now = new Date();
  const month = req.body.month ? parseInt(String(req.body.month), 10) : now.getMonth() + 1;
  const year = req.body.year ? parseInt(String(req.body.year), 10) : now.getFullYear();
  const groupId = req.body.group_id ? String(req.body.group_id) : undefined;

  try {
    const service = resolveReportsService(req);
    const summary = await service.sendBulkReports(tenantId, month, year, groupId);
    res.status(200).json({
      message: "Bulk reports successfully queued for dispatch",
      ...summary,
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: (err as Error).message },
    });
  }
});

// POST /api/reports/:student_id/send - Dispatch individual report to a student's parent
reportsRouter.post("/:student_id/send", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { student_id } = req.params;

  if (!tenantId) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  const now = new Date();
  const month = req.body.month ? parseInt(String(req.body.month), 10) : now.getMonth() + 1;
  const year = req.body.year ? parseInt(String(req.body.year), 10) : now.getFullYear();

  try {
    const service = resolveReportsService(req);
    const result = await service.sendIndividualReport(tenantId, student_id, month, year);
    res.status(200).json({
      message: "Student report dispatched successfully",
      report: result,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "STUDENT_NOT_FOUND") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found" } });
      return;
    }
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: msg },
    });
  }
});
