import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { validateBody } from "../../shared/middleware/validation.js";
import { requireCenterOwnerOrAdmin } from "../../shared/middleware/auth.js";
import { getServices } from "../../composition.js";

export const settingsRouter = Router();

export const DEFAULT_TENANT_SETTINGS = {
  homework_submission: "in_session",
  auto_notification: true,
  enable_top_performers: true,
};

const updateSettingsSchema = z.object({
  homework_submission: z.enum(["in_session", "online_before_session"]).optional(),
  auto_notification: z.boolean().optional(),
  enable_top_performers: z.boolean().optional(),
});

// GET /api/settings - Get tenant workflow settings
settingsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const tenantsRepo = getServices(req).tenants;
    const settings = tenantId ? await tenantsRepo.getTenantSettings(tenantId) : null;

    res.json({
      settings: {
        ...DEFAULT_TENANT_SETTINGS,
        ...(settings || {}),
      },
    });
  } catch (_err: unknown) {
    // Return default settings gracefully on failure
    res.json({ settings: DEFAULT_TENANT_SETTINGS });
  }
});

// PUT /api/settings - Update tenant workflow settings
// C-04: Role gate enforced - only owner, center_owner, or admin can modify tenant settings
settingsRouter.put(
  "/",
  requireCenterOwnerOrAdmin,
  validateBody(updateSettingsSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const targetTenantId = tenantId || "admin-tenant";
      const tenantsRepo = getServices(req).tenants;

      // Fetch existing settings via repository (scoped client)
      const existingSettings = await tenantsRepo.getTenantSettings(targetTenantId);

      const mergedSettings = {
        ...DEFAULT_TENANT_SETTINGS,
        ...(existingSettings || {}),
        ...req.body,
      };

      const updated = await tenantsRepo.updateTenantSettings(targetTenantId, mergedSettings);

      res.json({
        message: "Settings updated successfully",
        settings: updated || mergedSettings,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update tenant settings";
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to update tenant settings", details: message },
      });
    }
  }
);
