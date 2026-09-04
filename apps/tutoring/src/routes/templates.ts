import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { validateBody, saveTemplateSchema } from "../middleware/validation.js";

export const templatesRouter = Router();

// GET /api/templates - List all templates for current tenant
templatesRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;

  try {
    let query = supabase
      .from("message_templates")
      .select("id, tenant_id, template_type, variants, is_active, created_at, updated_at");

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: templates, error } = await query;

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({ templates });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Failed to list templates" } });
  }
});

// POST /api/templates - Create or update template variants
templatesRouter.post(
  "/",
  validateBody(saveTemplateSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { template_type, variants, is_active } = req.body;

    try {
      const { data, error } = await supabase
        .from("message_templates")
        .upsert(
          {
            tenant_id: tenantId,
            template_type,
            variants,
            is_active: is_active ?? true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,template_type" }
        )
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
        return;
      }

      res.status(200).json({ message: "Template saved successfully", template: data });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to save template" } });
    }
  }
);
