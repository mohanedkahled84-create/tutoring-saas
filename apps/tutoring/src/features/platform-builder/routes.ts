import { Router, Request, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServices } from "../../composition.js";
import {getServiceSupabaseClient} from "../../supabase.js";
import {currentPortalDestination,portalOrigin} from "../../shared/utils/portalDestination.js";
import {ensurePortalDomainReady} from '../../shared/utils/provisionPortalDomain.js';

export const publicPlatformRouter = Router();
export const platformRouter = Router();

// ============================================================================
// Public Routes (Accessible by students, parents, and visitors)
// ============================================================================

/**
 * GET /api/platform/public/:subdomain
 * Returns active platform settings for the specified subdomain
 */
publicPlatformRouter.get(
  "/public/:subdomain",
  async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control','no-store');
    const subdomain = req.params.subdomain;
    if (!subdomain) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "Subdomain is required" } });
      return;
    }

    try {
      const services = getServices(req as any);
      const service = (services as any).platformBuilder;
      const settings = await service.getPublicSettings(subdomain);

      if (!settings) {
        res.status(404).json({
          error: {
            code: "PLATFORM_NOT_FOUND",
            message: "المنصة المطلوبة غير موجودة أو غير مفعلة حالياً",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        settings,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch platform";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

/**
 * Retired anonymous content endpoint. Learning material is available only via
 * the verified student portal, which enforces current group/year membership.
 */
publicPlatformRouter.get("/public/:subdomain/content", (_req: Request, res: Response): void => {
  res.setHeader("Cache-Control", "no-store");
  res.status(401).json({ error: { code: "STUDENT_SESSION_REQUIRED", message: "سجّل دخولك لعرض المحتوى الدراسي الخاص بك" } });
});

/**
 * GET /api/platform/check/:subdomain
 * Checks if a subdomain is available
 */
publicPlatformRouter.get(
  "/check/:subdomain",
  async (req: Request, res: Response): Promise<void> => {
    const subdomain = req.params.subdomain;

    try {
      const services = getServices(req as any);
      const service = (services as any).platformBuilder;
      const result = await service.checkSubdomainAvailability(subdomain);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Check failed";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

/**
 * POST /api/platform/public/:subdomain/video-view
 * Records student video watch progress in the database
 */
publicPlatformRouter.post(
  "/public/:subdomain/video-view",
  async (req: Request, res: Response): Promise<void> => {
    const subdomain = req.params.subdomain;
    if (!subdomain) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "Subdomain is required" } });
      return;
    }

    try {
      const services = getServices(req as any);
      const service = (services as any).platformBuilder;
      await service.recordVideoView(subdomain, req.body || {});

      res.status(200).json({
        success: true,
        message: "تم تسجيل نشاط المشاهدة بنجاح",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to record video view";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// ============================================================================
// Protected Routes (Teacher Backoffice Management)
// ============================================================================

// Administrative overrides use the verified server role only.
function isPlatformAdministrator(req: AuthenticatedRequest): boolean {
  return req.user?.role === "admin";
}

/**
 * GET /api/platform/settings
 * Retrieves teacher's platform settings and current plan tier
 */
platformRouter.get(
  "/settings",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
      return;
    }

    try {
      const services = getServices(req);
      const service = (services as any).platformBuilder;
      const isPlatformAdmin = isPlatformAdministrator(req);
      const data = await service.getTeacherSettings(tenantId, isPlatformAdmin);
      const db = getServiceSupabaseClient();
      let destination = await currentPortalDestination(db, tenantId).catch(() => ({ origin: portalOrigin(), presentation: null }));
      if (data.settings?.is_active === true && data.settings?.subdomain && destination.presentation?.subdomain !== data.settings.subdomain) {
        await ensurePortalDomainReady(db, tenantId, { maxWaitMs: 2500, intervalMs: 1000 }).catch(() => false);
        destination = await currentPortalDestination(db, tenantId).catch(() => destination);
      }

      res.status(200).json({
        success: true,
        settings: data.settings,
        plan: data.plan,
        destination,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch settings";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

/**
 * POST /api/platform/settings
 * Creates or updates teacher's platform settings (enforces PRO tier requirement)
 */
platformRouter.post(
  "/settings",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
      return;
    }

    try {
      const services = getServices(req);
      const service = (services as any).platformBuilder;
      const isPlatformAdmin = isPlatformAdministrator(req);
      const saved = await service.savePlatformSettings(tenantId, req.body, isPlatformAdmin);
      const db = getServiceSupabaseClient();
      if (saved?.is_active === true && saved?.subdomain) {
        await ensurePortalDomainReady(db, tenantId, { maxWaitMs: 20000, intervalMs: 1500 }).catch(() => false);
      }

      res.status(200).json({
        success: true,
        settings: saved,
        destination: await currentPortalDestination(db, tenantId).catch(() => ({ origin: portalOrigin(), presentation: null })),
      });
    } catch (err: any) {
      const statusCode = err?.statusCode || 500;
      const code = err?.code || (statusCode === 403 ? "PRO_REQUIRED" : "BAD_REQUEST");
      const message = err instanceof Error ? err.message : "Failed to save platform settings";

      res.status(statusCode).json({
        error: { code, message },
      });
    }
  }
);

/**
 * GET /api/platform/video-views
 * Returns real student video tracking logs for the teacher's tenant
 */
platformRouter.get(
  "/video-views",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
      return;
    }

    try {
      const services = getServices(req);
      const service = (services as any).platformBuilder;
      const views = await service.getVideoViews(tenantId);

      res.status(200).json({
        success: true,
        views: views || [],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch video views";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

platformRouter.delete(
  "/video-views/:studentCode",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const studentCode = String(req.params.studentCode || "").trim();
    if (!tenantId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
      return;
    }
    if (!studentCode || studentCode.length > 100) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "كود الطالب غير صالح" } });
      return;
    }

    try {
      const service = (getServices(req) as any).platformBuilder;
      await service.resetVideoView(tenantId, studentCode);
      res.status(200).json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reset video view";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);
