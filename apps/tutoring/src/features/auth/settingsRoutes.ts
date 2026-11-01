import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { validateBody } from "../../shared/middleware/validation.js";
import { requireCenterOwnerOrAdmin } from "../../shared/middleware/auth.js";
import { getServices } from "../../composition.js";
import { supabasePublic, getScopedSupabaseClient } from "../../supabase.js";

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
  teacher_name: z.string().optional(),
  subject: z.string().optional(),
  phone: z.string().optional(),
  contact_phone: z.string().optional(),
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
    const resolvedContactPhone = (settings as any)?.contact_phone || (settings as any)?.whatsapp_phone || req.user?.phone || "";

    res.json({
      settings: {
        ...DEFAULT_TENANT_SETTINGS,
        ...(settings || {}),
        contact_phone: resolvedContactPhone,
        subject: req.user?.subject || (settings as any)?.subject || "",
      },
      user: {
        id: req.user?.id,
        name: req.user?.name || req.user?.full_name,
        full_name: req.user?.full_name,
        phone: req.user?.phone || "",
        contact_phone: resolvedContactPhone,
        subject: req.user?.subject || (settings as any)?.subject || "",
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

      if (req.body.contact_phone !== undefined) {
        mergedSettings.contact_phone = normalizeDigits(req.body.contact_phone);
      }

      const updated = await tenantsRepo.updateTenantSettings(tenantId, mergedSettings);

      // Also update user profile in public.users if teacher_name, phone, or subject are passed
      const userUpdates: Record<string, string> = {};
      if (req.body.teacher_name !== undefined) userUpdates.full_name = req.body.teacher_name.trim();
      if (req.body.phone !== undefined) userUpdates.phone = normalizeDigits(req.body.phone);
      if (req.body.subject !== undefined) userUpdates.subject = req.body.subject.trim();

      if (Object.keys(userUpdates).length > 0 && req.user?.id) {
        const client = req.supabase || (req.token ? getScopedSupabaseClient(req.token) : supabasePublic);
        await client.from("users").update(userUpdates).eq("id", req.user.id);

        // Also update teacher in public.teachers if teacher record exists
        const teacherUpdates: Record<string, any> = {};
        if (userUpdates.full_name) teacherUpdates.name = userUpdates.full_name;
        if (userUpdates.phone) teacherUpdates.phone = userUpdates.phone;
        if (userUpdates.subject) teacherUpdates.subjects = [userUpdates.subject];
        if (Object.keys(teacherUpdates).length > 0) {
          await client.from("teachers").update(teacherUpdates).eq("user_id", req.user.id);
        }
      }

      res.json({
        message: "Settings updated successfully",
        settings: updated || mergedSettings,
        user: {
          id: req.user?.id,
          name: userUpdates.full_name ?? req.user?.name,
          full_name: userUpdates.full_name ?? req.user?.full_name,
          phone: userUpdates.phone ?? req.user?.phone,
          contact_phone: mergedSettings.contact_phone || (existingSettings as any)?.contact_phone || req.user?.phone || "",
          subject: userUpdates.subject ?? req.user?.subject,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update tenant settings";
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to update tenant settings", details: message },
      });
    }
  }
);

// The owner retired the extra financial PIN. Account login and role checks remain.
settingsRouter.get('/security-pin',(_req,res)=>{res.set('Cache-Control','no-store');res.json({has_pin:false,retired:true});});
const retiredPin=(_req:AuthenticatedRequest,res:Response):void=>{res.status(410).json({error:{code:'FINANCIAL_PIN_RETIRED',message:'تم إلغاء رمز القفل الداخلي؛ صلاحيات الحساب تحدد الوصول'}});};
settingsRouter.post('/security-pin',retiredPin);
settingsRouter.delete('/security-pin',retiredPin);
settingsRouter.post('/verify-pin',retiredPin);
settingsRouter.post('/security-pin/request-reset',retiredPin);
