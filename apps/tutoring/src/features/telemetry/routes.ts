import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireFeatureFlag } from "../../shared/middleware/featureFlags.js";
import { telemetryRateLimiter } from "../../shared/middleware/rateLimit.js";
import { extractToken } from "../../shared/middleware/auth.js";
import { getServices } from "../../composition.js";
import { TelemetryService } from "./service.js";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { supabasePublic, getServiceSupabaseClient } from "../../supabase.js";

export const telemetryRouter = Router();

// Guarded by behaviorTracking feature flag and dedicated rate limiter (DEV-55 / M-02)
telemetryRouter.use(requireFeatureFlag("behaviorTracking"));
telemetryRouter.use(telemetryRateLimiter);

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
// M-02: Rate-limited, schema-validated, and binds verified tenant_id exclusively from auth token
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
      let tenantId: string | null = authReq.user?.tenant_id || null;

      // If user not already resolved, check for session token to bind legitimate tenant_id
      if (!tenantId) {
        const token = extractToken(authReq);
        if (token) {
          try {
            const { data: authData, error: authError } = await supabasePublic.auth.getUser(token);
            if (!authError && authData?.user) {
              const supabase = getServiceSupabaseClient();
              const { data: userRec } = await supabase
                .from("users")
                .select("tenant_id")
                .eq("id", authData.user.id)
                .single();
              tenantId = userRec?.tenant_id || null;
            }
          } catch {
            tenantId = null;
          }
        }
      }

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

