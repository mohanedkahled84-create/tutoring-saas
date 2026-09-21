import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { config } from "../../shared/config/index.js";

function getSupabase(req: AuthenticatedRequest) {
  return (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();
}

export const assistantsRouter = Router();

// GET /api/assistants - List assistants
assistantsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const supabase = getSupabase(req);
    let assistants: any[] = [];
    const { data, error } = await supabase
      .from("assistants")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      assistants = data;
    } else {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("list_assistants_secure", {
        p_tenant_id: tenantId,
      });
      if (rpcErr) throw rpcErr;
      assistants = Array.isArray(rpcData) ? rpcData : [];
    }

    res.json({ assistants, count: assistants.length });
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
    const supabase = getSupabase(req);

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

    let createdAssistant: any = null;
    let insertError: any = null;

    // Try direct insert first
    const { data: directData, error: directErr } = await supabase
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
      .maybeSingle();

    if (!directErr && directData) {
      createdAssistant = directData;
    } else {
      insertError = directErr;
      // Fallback to secure RPC
      const { data: rpcRow, error: rpcErr } = await supabase.rpc("create_assistant_secure", {
        p_tenant_id: tenantId,
        p_name: name.trim(),
        p_phone: phone.trim(),
        p_assistant_type: "assistant_to_teacher",
        p_teacher_id: resolvedTeacherId,
        p_can_view_financials: false,
        p_status: "active",
        p_salary: salaryVal,
        p_role_type: role_type || "both",
        p_group_id: cleanGroupId,
        p_salary_model: salary_model || "monthly",
      });

      if (rpcErr || !rpcRow) {
        throw new Error(rpcErr ? rpcErr.message : (insertError?.message || "Failed to create assistant"));
      }
      createdAssistant = rpcRow;
    }

    res.status(201).json({ success: true, assistant: createdAssistant });
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
  const cleanGroupId = group_id && typeof group_id === "string" && group_id.trim().length > 0 ? group_id.trim() : null;
  const salaryVal = Number(req.body.salary ?? req.body.salary_amount) || 0;

  try {
    const supabase = getSupabase(req);
    const updates: Record<string, any> = {};
    if (name) updates.name = name.trim();
    if (phone) updates.phone = phone.trim();
    if (role_type) updates.role_type = role_type;
    if (group_id !== undefined) {
      updates.group_id = cleanGroupId;
    }
    if (salary_model) updates.salary_model = salary_model;
    if (req.body.salary !== undefined || req.body.salary_amount !== undefined) {
      updates.salary = salaryVal;
    }
    if (status) updates.status = status;

    let updatedAssistant: any = null;
    let updateError: any = null;

    const { data: directData, error: directErr } = await supabase
      .from("assistants")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select()
      .maybeSingle();

    if (!directErr && directData) {
      updatedAssistant = directData;
    } else {
      updateError = directErr;
      const { data: rpcRow, error: rpcErr } = await supabase.rpc("update_assistant_secure", {
        p_id: id,
        p_tenant_id: tenantId,
        p_name: name ? name.trim() : undefined,
        p_phone: phone ? phone.trim() : undefined,
        p_role_type: role_type || undefined,
        p_group_id: cleanGroupId,
        p_clear_group: group_id === null || group_id === "",
        p_salary_model: salary_model || undefined,
        p_salary: (req.body.salary !== undefined || req.body.salary_amount !== undefined) ? salaryVal : undefined,
        p_status: status || undefined,
      });

      if (rpcErr || !rpcRow) {
        throw new Error(rpcErr ? rpcErr.message : (updateError?.message || "Failed to update assistant"));
      }
      updatedAssistant = rpcRow;
    }

    res.json({ success: true, assistant: updatedAssistant });
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
    const supabase = getSupabase(req);
    const { error: directErr } = await supabase
      .from("assistants")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (directErr) {
      const { error: rpcErr } = await supabase.rpc("delete_assistant_secure", {
        p_id: id,
        p_tenant_id: tenantId,
      });
      if (rpcErr) throw rpcErr;
    }

    res.json({ success: true, message: "تم حذف المساعد بنجاح" });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});
