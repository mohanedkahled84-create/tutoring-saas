import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { requireAdmin } from "../../shared/middleware/auth.js";
import { requireFeatureFlag } from "../../shared/middleware/featureFlags.js";
import { getServices } from "../../composition.js";
import { BusinessDashboardService } from "./service.js";

export const businessDashboardRouter = Router();

// Apply feature flag middleware to entire router
businessDashboardRouter.use(requireFeatureFlag("businessDashboard"));

// GET /api/business-dashboard/metrics - Cross-tenant founder analytics
businessDashboardRouter.get(
  "/metrics",
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const services = getServices(req);
      const dashboardService = services.businessDashboard as BusinessDashboardService;

      const data = await dashboardService.getMetrics();
      res.json(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load business dashboard";
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message,
        },
      });
    }
  }
);
