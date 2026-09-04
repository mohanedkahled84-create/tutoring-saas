import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { validateBody } from "../../shared/middleware/validation.js";
import { getServiceSupabaseClient } from "../../supabase.js";

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

  const supabase = getServiceSupabaseClient();
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, name, settings")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) {
    // Return default settings gracefully
    res.json({ settings: DEFAULT_TENANT_SETTINGS });
    return;
  }

  res.json({
    settings: {
      ...DEFAULT_TENANT_SETTINGS,
      ...(tenant.settings || {}),
    },
  });
});

// PUT /api/settings - Update tenant workflow settings
settingsRouter.put(
  "/",
  validateBody(updateSettingsSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    const supabase = getServiceSupabaseClient();

    // Fetch existing settings
    const { data: tenant } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single();

    const mergedSettings = {
      ...DEFAULT_TENANT_SETTINGS,
      ...(tenant?.settings || {}),
      ...req.body,
    };

    const { error: updateError } = await supabase
      .from("tenants")
      .update({ settings: mergedSettings })
      .eq("id", tenantId);

    if (updateError) {
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to update tenant settings", details: updateError.message },
      });
      return;
    }

    res.json({
      message: "Settings updated successfully",
      settings: mergedSettings,
    });
  }
);
