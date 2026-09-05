import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireFeatureFlag } from "../../shared/middleware/featureFlags.js";
import { getServices } from "../../composition.js";
import { TelemetryService } from "./service.js";
import { AuthenticatedRequest } from "../../shared/types/index.js";

export const telemetryRouter = Router();

// Guarded by behaviorTracking feature flag
telemetryRouter.use(requireFeatureFlag("behaviorTracking"));

const telemetryEventsSchema = z.object({
  events: z
    .array(
      z.object({
        event_name: z.string().min(1).max(100),
        properties: z.record(z.string(), z.unknown()).optional(),
        page_path: z.string().max(300).optional(),
        session_id: z.string().max(150).optional(),
        timestamp: z.string().optional(),
      })
    )
    .min(1)
    .max(50),
});

// POST /api/telemetry/events - Ingest batched client/product behavior events
telemetryRouter.post(
  "/events",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = telemetryEventsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid telemetry events payload",
          details: parsed.error.issues,
        },
      });
      return;
    }

    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user?.tenant_id || null;
      const services = getServices(authReq);
      const telemetryService = services.telemetry as TelemetryService;

      const result = await telemetryService.trackEvents(tenantId, parsed.data.events);
      res.status(200).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to record telemetry";
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message,
        },
      });
    }
  }
);
