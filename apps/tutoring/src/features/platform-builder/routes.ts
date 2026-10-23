import { Router, Request, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServices } from "../../composition.js";

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
 * GET /api/platform/public/:subdomain/content
 * Returns public study materials, video lessons, and homework for the tenant platform
 */
publicPlatformRouter.get(
  "/public/:subdomain/content",
  async (req: Request, res: Response): Promise<void> => {
    const subdomain = req.params.subdomain;
    if (!subdomain) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "Subdomain is required" } });
      return;
    }

    try {
      const services = getServices(req as any);
      const service = (services as any).platformBuilder;
      const materials = await service.getPublicMaterials(subdomain);

      res.status(200).json({
        success: true,
        materials: materials || [],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch platform content";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

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

// ============================================================================
// Protected Routes (Teacher Backoffice Management)
// ============================================================================

/**
 * Helper to check if the current user is an admin or Mr. Omar test account
 */
function isUserAdminOrOmar(req: AuthenticatedRequest): boolean {
  const adminEmails = [
    'mohanedkahled84@gmail.com',
    'mohanedkhaled84@gmail.com',
    'mohanedkhaled2367@gmail.com',
    'teacher@centrly.app',
    'mohanedabdulhalim@gmail.com',
  ];
  const userEmail = (req.user?.email || '').toLowerCase();
  return Boolean(
    req.user?.role === 'admin' ||
    (req.user as any)?.is_superadmin ||
    adminEmails.includes(userEmail) ||
    req.user?.tenant_id === '0c67b644-ae42-49e8-975f-85b9d0af0e1b' ||
    userEmail.includes('omar') ||
    userEmail.includes('mohamadi')
  );
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
      const isAdminOrOmar = isUserAdminOrOmar(req);
      const data = await service.getTeacherSettings(tenantId, isAdminOrOmar);

      res.status(200).json({
        success: true,
        settings: data.settings,
        plan: data.plan,
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
      const isAdminOrOmar = isUserAdminOrOmar(req);
      const saved = await service.savePlatformSettings(tenantId, req.body, isAdminOrOmar);

      res.status(200).json({
        success: true,
        settings: saved,
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
