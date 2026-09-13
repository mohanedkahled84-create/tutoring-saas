import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServiceSupabaseClient } from "../../supabase.js";

export const assistantsRouter = Router();

// GET /api/assistants - List assistants
assistantsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from("assistants")
      .select("*, groups:group_id(id, name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ assistants: data || [], count: (data || []).length });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});

// POST /api/assistants - Create an assistant
assistantsRouter.post("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  const { name, phone, role_type, group_id, salary_model } = req.body;
  const salaryVal = Number(req.body.salary ?? req.body.salary_amount) || 0;
  const cleanGroupId = group_id && typeof group_id === "string" && group_id.trim().length > 0 ? group_id.trim() : null;

  if (!name || !phone) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "الاسم ورقم الهاتف مطلوبان" } });
    return;
  }

  try {
    const supabase = getServiceSupabaseClient();

    // Safely resolve teacher_id against teachers table foreign key
    let resolvedTeacherId: string | null = null;
    if (req.user?.id) {
      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", req.user.id)
        .maybeSingle();
      if (teacherRow?.id) {
        resolvedTeacherId = teacherRow.id;
      }
    }

    const { data, error } = await supabase
      .from("assistants")
      .insert({
        tenant_id: tenantId,
        teacher_id: resolvedTeacherId,
        name: name.trim(),
        phone: phone.trim(),
        role_type: role_type || "both",
        assistant_type: "assistant_to_teacher",
        can_view_financials: false,
        group_id: cleanGroupId,
        salary_model: salary_model || "monthly",
        salary: salaryVal,
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, assistant: data });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});

// PUT /api/assistants/:id - Update an assistant
assistantsRouter.put("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;

  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  const { name, phone, role_type, group_id, salary_model, status } = req.body;

  try {
    const supabase = getServiceSupabaseClient();
    const updates: Record<string, any> = {};
    if (name) updates.name = name.trim();
    if (phone) updates.phone = phone.trim();
    if (role_type) updates.role_type = role_type;
    if (group_id !== undefined) {
      updates.group_id = group_id && typeof group_id === "string" && group_id.trim().length > 0 ? group_id.trim() : null;
    }
    if (salary_model) updates.salary_model = salary_model;
    if (req.body.salary !== undefined || req.body.salary_amount !== undefined) {
      updates.salary = Number(req.body.salary ?? req.body.salary_amount) || 0;
    }
    if (status) updates.status = status;

    const { data, error } = await supabase
      .from("assistants")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, assistant: data });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});

// DELETE /api/assistants/:id - Delete an assistant
assistantsRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;

  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const supabase = getServiceSupabaseClient();
    const { error } = await supabase
      .from("assistants")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) throw error;

    res.json({ success: true, message: "تم حذف المساعد بنجاح" });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});
