import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { validateBody } from "../../shared/middleware/validation.js";
import { requireCenterOwnerOrAdmin } from "../../shared/middleware/auth.js";
import { getServices } from "../../composition.js";

export const settingsRouter = Router();

export function normalizeDigits(str: unknown): string {
  if (!str && str !== 0) return "";
  return String(str)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .trim();
}

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
  pin: z
    .string()
    .transform((val) => normalizeDigits(val))
    .pipe(z.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits")),
  old_pin: z.string().optional().nullable(),
});

const verifyPinSchema = z.object({
  pin: z
    .string()
    .min(1, "PIN is required")
    .transform((val) => normalizeDigits(val)),
});

// GET /api/settings/security-pin - Check if user account or tenant has configured financial security PIN
settingsRouter.get("/security-pin", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const tenantId = req.user?.tenant_id;
  if (!userId && !tenantId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    return;
  }

  try {
    if (req.user?.financial_pin) {
      res.json({ has_pin: true });
      return;
    }

    const tenantsRepo = getServices(req).tenants;

    if (userId && typeof tenantsRepo.getUserPin === "function") {
      const userPin = await tenantsRepo.getUserPin(userId).catch(() => null);
      if (userPin) {
        if (req.user) {
          req.user.financial_pin = normalizeDigits(userPin);
          req.user.has_security_pin = true;
        }
        res.json({ has_pin: true });
        return;
      }
    }

    if (tenantId) {
      const settings = await tenantsRepo.getTenantSettings(tenantId).catch(() => null);
      if (settings?.financial_pin) {
        if (req.user) {
          req.user.financial_pin = normalizeDigits(settings.financial_pin);
          req.user.has_security_pin = true;
        }
        res.json({ has_pin: true });
        return;
      }
    }

    res.json({ has_pin: false });
  } catch {
    res.json({ has_pin: false });
  }
});

// POST /api/settings/security-pin - Set or update financial security PIN
settingsRouter.post(
  "/security-pin",
  validateBody(setPinSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id;
    if (!userId && !tenantId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    try {
      const tenantsRepo = getServices(req).tenants;

      let existingPin: string | null = req.user?.financial_pin ? normalizeDigits(req.user.financial_pin) : null;
      if (!existingPin && userId && typeof tenantsRepo.getUserPin === "function") {
        const uPin = await tenantsRepo.getUserPin(userId).catch(() => null);
        if (uPin) existingPin = normalizeDigits(uPin);
      }
      let existingSettings: any = null;
      if (tenantId) {
        existingSettings = await tenantsRepo.getTenantSettings(tenantId).catch(() => null);
        if (!existingPin && existingSettings?.financial_pin) {
          existingPin = normalizeDigits(existingSettings.financial_pin);
        }
      }

      if (existingPin && req.body.old_pin) {
        const cleanOldPin = normalizeDigits(req.body.old_pin);
        if (existingPin !== cleanOldPin) {
          res.status(400).json({ error: { code: "INVALID_OLD_PIN", message: "الرقم السري الحالي غير صحيح" } });
          return;
        }
      }

      const newPin = normalizeDigits(req.body.pin);

      // 1. Persist directly to user account in repository
      if (userId && typeof tenantsRepo.setUserPin === "function") {
        await tenantsRepo.setUserPin(userId, newPin);
      }

      // 2. Also persist to tenant settings for backward compatibility
      if (tenantId) {
        const mergedSettings = {
          ...DEFAULT_TENANT_SETTINGS,
          ...(existingSettings || {}),
          financial_pin: newPin,
        };
        await tenantsRepo.updateTenantSettings(tenantId, mergedSettings as any).catch(() => null);
      }

      if (req.user) {
        req.user.financial_pin = newPin;
        req.user.has_security_pin = true;
      }

      res.json({ success: true, message: "تم تعيين وتأمين الرقم السري بنجاح وربطه بحسابك سحابياً عبر كافة الأجهزة" });
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
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id;
    if (!userId && !tenantId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    try {
      const tenantsRepo = getServices(req).tenants;
      let savedPin: string | null = req.user?.financial_pin ? normalizeDigits(req.user.financial_pin) : null;

      if (!savedPin && userId && typeof tenantsRepo.getUserPin === "function") {
        const uPin = await tenantsRepo.getUserPin(userId).catch(() => null);
        if (uPin) savedPin = normalizeDigits(uPin);
      }

      if (!savedPin && tenantId) {
        const existingSettings = await tenantsRepo.getTenantSettings(tenantId).catch(() => null);
        if ((existingSettings as any)?.financial_pin) {
          savedPin = normalizeDigits((existingSettings as any).financial_pin);
        }
      }

      const cleanInputPin = normalizeDigits(req.body.pin);
      const isValid = Boolean(savedPin && cleanInputPin && savedPin === cleanInputPin);
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
  .default({ pin: undefined });

// DELETE /api/settings/security-pin - Remove financial security PIN
settingsRouter.delete(
  "/security-pin",
  validateBody(deletePinSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id;
    if (!userId && !tenantId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    try {
      const tenantsRepo = getServices(req).tenants;

      let savedPin: string | null = req.user?.financial_pin ? normalizeDigits(req.user.financial_pin) : null;
      if (!savedPin && userId && typeof tenantsRepo.getUserPin === "function") {
        const uPin = await tenantsRepo.getUserPin(userId).catch(() => null);
        if (uPin) savedPin = normalizeDigits(uPin);
      }
      let existingSettings: any = null;
      if (!savedPin && tenantId) {
        existingSettings = await tenantsRepo.getTenantSettings(tenantId).catch(() => null);
        if ((existingSettings as any)?.financial_pin) {
          savedPin = normalizeDigits((existingSettings as any).financial_pin);
        }
      }

      const cleanInputPin = req.body?.pin ? normalizeDigits(req.body.pin) : null;
      const cleanSavedPin = savedPin ? normalizeDigits(savedPin) : null;

      if (cleanInputPin && cleanSavedPin && cleanSavedPin !== cleanInputPin) {
        res.status(400).json({ error: { code: "INVALID_PIN", message: "الرقم السري الحالي غير صحيح" } });
        return;
      }

      if (userId && typeof tenantsRepo.setUserPin === "function") {
        await tenantsRepo.setUserPin(userId, null);
      }

      if (tenantId) {
        if (!existingSettings) {
          existingSettings = await tenantsRepo.getTenantSettings(tenantId).catch(() => null);
        }
        const mergedSettings = { ...existingSettings };
        delete (mergedSettings as any).financial_pin;
        await tenantsRepo.updateTenantSettings(tenantId, mergedSettings as any).catch(() => null);
      }

      if (req.user) {
        req.user.financial_pin = null;
        req.user.has_security_pin = false;
      }

      res.json({ success: true, message: "تم إزالة الرقم السري بنجاح" });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);
