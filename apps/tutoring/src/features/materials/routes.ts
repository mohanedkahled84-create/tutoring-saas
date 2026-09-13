import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServiceSupabaseClient } from "../../supabase.js";

export const materialsRouter = Router();

// GET /api/materials - List materials for tenant / group
materialsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  const groupId = req.query.group_id as string | undefined;

  try {
    const supabase = getServiceSupabaseClient();
    let query = supabase
      .from("study_materials")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (groupId) {
      query = query.or(`group_id.eq.${groupId},group_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ materials: data || [], count: (data || []).length });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});

// POST /api/materials - Create a new study material / homework
materialsRouter.post("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  const { title, description, type, url, group_id, is_homework, due_date } = req.body;

  if (!title || !url) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "العنوان والرابط مطلوبان" } });
    return;
  }

  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from("study_materials")
      .insert({
        tenant_id: tenantId,
        teacher_id: req.user?.id || null,
        title: title.trim(),
        description: description ? description.trim() : null,
        type: type || "pdf",
        url: url.trim(),
        group_id: group_id || null,
        is_homework: Boolean(is_homework),
        due_date: due_date || null,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, material: data });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});

// DELETE /api/materials/:id - Delete a study material
materialsRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;

  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const supabase = getServiceSupabaseClient();
    const { error } = await supabase
      .from("study_materials")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) throw error;

    res.json({ success: true, message: "تم حذف المادة بنجاح" });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});
