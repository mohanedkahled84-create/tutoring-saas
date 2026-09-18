import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { validateBody } from "../../shared/middleware/validation.js";
import { requireCenterOwnerOrAdmin } from "../../shared/middleware/auth.js";
import { getServices } from "../../composition.js";

export const settingsRouter = Router();

export const DEFAULT_TENANT_SETTINGS = {
  homework_submission: "in_session" as const,
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
  if (!tenantId) {
    res.status(400).json({
      error: {
        code: "TENANT_CONTEXT_REQUIRED",
        message: "No tenant context available for this request.",
      },
    });
    return;
  }

  try {
    const tenantsRepo = getServices(req).tenants;
    const settings = await tenantsRepo.getTenantSettings(tenantId);

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
    if (!tenantId) {
      res.status(400).json({
        error: {
          code: "TENANT_CONTEXT_REQUIRED",
          message: "No tenant context available for this request.",
        },
      });
      return;
    }

    try {
      const tenantsRepo = getServices(req).tenants;

      // Fetch existing settings via repository (scoped client)
      const existingSettings = await tenantsRepo.getTenantSettings(tenantId);

      const mergedSettings = {
        ...DEFAULT_TENANT_SETTINGS,
        ...(existingSettings || {}),
        ...req.body,
      };

      const updated = await tenantsRepo.updateTenantSettings(tenantId, mergedSettings);

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

const setPinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits"),
  old_pin: z.string().optional().nullable(),
});

const verifyPinSchema = z.object({
  pin: z.string().min(1, "PIN is required"),
});

// GET /api/settings/security-pin - Check if tenant has configured financial security PIN
settingsRouter.get("/security-pin", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(400).json({ error: { code: "TENANT_CONTEXT_REQUIRED", message: "No tenant context" } });
    return;
  }
  try {
    const tenantsRepo = getServices(req).tenants;
    const settings = await tenantsRepo.getTenantSettings(tenantId);
    res.json({ has_pin: Boolean(settings?.financial_pin) });
  } catch {
    res.json({ has_pin: false });
  }
});

// POST /api/settings/security-pin - Set or update financial security PIN
settingsRouter.post(
  "/security-pin",
  validateBody(setPinSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(400).json({ error: { code: "TENANT_CONTEXT_REQUIRED", message: "No tenant context" } });
      return;
    }
    try {
      const tenantsRepo = getServices(req).tenants;
      const existingSettings = await tenantsRepo.getTenantSettings(tenantId);
      if (existingSettings?.financial_pin && req.body.old_pin) {
        if (existingSettings.financial_pin !== req.body.old_pin) {
          res.status(400).json({ error: { code: "INVALID_OLD_PIN", message: "الرقم السري الحالي غير صحيح" } });
          return;
        }
      }
      const mergedSettings = {
        ...DEFAULT_TENANT_SETTINGS,
        ...(existingSettings || {}),
        financial_pin: req.body.pin,
      };
      await tenantsRepo.updateTenantSettings(tenantId, mergedSettings as any);
      res.json({ success: true, message: "تم تعيين وتأمين الرقم السري بنجاح عبر السحابة وكافة الأجهزة" });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);

// POST /api/settings/verify-pin - Verify financial security PIN
settingsRouter.post(
  "/verify-pin",
  validateBody(verifyPinSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(400).json({ error: { code: "TENANT_CONTEXT_REQUIRED", message: "No tenant context" } });
      return;
    }
    try {
      const tenantsRepo = getServices(req).tenants;
      const existingSettings = await tenantsRepo.getTenantSettings(tenantId);
      const savedPin = (existingSettings as any)?.financial_pin;
      const isValid = Boolean(savedPin && savedPin === req.body.pin);
      res.json({ valid: isValid });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);

const deletePinSchema = z
  .object({
    pin: z.string().optional().nullable(),
  })
  .optional()
  .default({});

// DELETE /api/settings/security-pin - Remove financial security PIN
settingsRouter.delete(
  "/security-pin",
  validateBody(deletePinSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(400).json({ error: { code: "TENANT_CONTEXT_REQUIRED", message: "No tenant context" } });
      return;
    }
    try {
      const tenantsRepo = getServices(req).tenants;
      const existingSettings = await tenantsRepo.getTenantSettings(tenantId);
      if (req.body?.pin && (existingSettings as any)?.financial_pin && (existingSettings as any).financial_pin !== req.body.pin) {
        res.status(400).json({ error: { code: "INVALID_PIN", message: "الرقم السري الحالي غير صحيح" } });
        return;
      }
      const mergedSettings = { ...existingSettings };
      delete (mergedSettings as any).financial_pin;
      await tenantsRepo.updateTenantSettings(tenantId, mergedSettings as any);
      res.json({ success: true, message: "تم إزالة الرقم السري بنجاح" });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);
