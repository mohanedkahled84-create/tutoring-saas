import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServiceSupabaseClient, supabasePublic } from "../../supabase.js";
import { config } from "../../shared/config/index.js";
import { attachPayroll, payPeriod, validatePay } from "./payroll.js";
import { assistantManagementRouter } from "./access.js";
import { portalOrigin } from "../../shared/utils/portalDestination.js";

function getSupabase(req: AuthenticatedRequest) {
  return (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || supabasePublic;
}

export const assistantsRouter = Router();
assistantsRouter.use(assistantManagementRouter);

const ASSISTANT_MANAGER_ROLES = new Set(["admin", "owner", "center_owner", "teacher"]);

function canManageAssistants(req: AuthenticatedRequest): boolean {
  return ASSISTANT_MANAGER_ROLES.has(req.user?.role || "");
}

// GET /api/assistants - List assistants
assistantsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!canManageAssistants(req)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions to view assistants" } });
    return;
  }
  const tenantId = req.user?.tenant_id;
  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const supabase = getSupabase(req);
    let period;
    try { period = payPeriod(req.query.month, req.query.year); }
    catch (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: (error as Error).message } });
      return;
    }
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
      if (!rpcErr && Array.isArray(rpcData)) {
        assistants = rpcData;
      } else {
        const { data: pubData, error: pubErr } = await supabase
          .from("assistants")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });
        if (pubErr) throw pubErr;
        assistants = Array.isArray(pubData) ? pubData : [];
      }
    }

    const [{data:accessRows,error:accessError},{data:invitations,error:invitationError}] = await Promise.all([
      supabase.from('assistant_accounts').select('assistant_id,permissions,all_groups,group_ids').eq('tenant_id',tenantId),
      supabase.from('assistant_invitations').select('assistant_id,delivery_status,expires_at,accepted_at,revoked_at,created_at').eq('tenant_id',tenantId).order('created_at',{ascending:false}),
    ]);
    if(accessError || invitationError) throw accessError || invitationError;
    assistants=assistants.map(a=>({...a,assistant_login_url:`${portalOrigin()}/assistant?workspace=${tenantId}`,access:accessRows?.find(x=>x.assistant_id===a.id) || null,invitation:invitations?.find(x=>x.assistant_id===a.id) || null}));
    const withPayroll = await attachPayroll(supabase, tenantId!, assistants, period);
    res.json({ assistants: withPayroll, count: withPayroll.length, period });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});

// POST /api/assistants - Create an assistant
assistantsRouter.post("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!canManageAssistants(req)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions to manage assistants" } });
    return;
  }
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

  let pay;
  try { pay = validatePay(req.body); }
  catch (error) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: (error as Error).message } });
    return;
  }

  try {
    const supabase = getSupabase(req);

    // Safely resolve teacher_id against teachers table foreign key
    let resolvedTeacherId: string | null = req.user?.teacher_id || null;
    if (!resolvedTeacherId && req.user?.id) {
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

    // Try direct insert first via user client
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
        ...pay,
        status: "active",
      })
      .select()
      .maybeSingle();

    if (!directErr && directData) {
      createdAssistant = directData;
    } else if (pay.salary_model === "per_day" || pay.pay_start_date || pay.work_weekdays.length) {
      // Legacy RPC signatures cannot persist a work schedule; never report a partial save as success.
      throw directErr || new Error("Failed to save assistant pay schedule");
    } else {
      // Fallback 1: secure RPC through the authenticated or service-role client
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

      if (!rpcErr && rpcRow) {
        createdAssistant = rpcRow;
      } else {
        // Fallback 2: direct insert through the authenticated client (RLS applies)
        const { data: pubData, error: pubErr } = await supabase
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

        if (pubErr || !pubData) {
          throw new Error(pubErr?.message || rpcErr?.message || directErr?.message || "Failed to create assistant");
        }
        createdAssistant = pubData;
      }
    }

    res.status(201).json({ success: true, assistant: createdAssistant });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});

// PUT /api/assistants/:id - Update an assistant
assistantsRouter.put("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!canManageAssistants(req)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions to manage assistants" } });
    return;
  }
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
    const { data: previous, error: previousError } = await supabase.from("assistants")
      .select("salary_model,salary,work_weekdays,pay_start_date")
      .eq("id", id).eq("tenant_id", tenantId).maybeSingle();
    if (previousError) throw previousError;
    if (!previous) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "المساعد غير موجود" } });
      return;
    }
    const {data:linkedAccount,error:linkedError}=await supabase.from('assistant_accounts').select('assistant_id').eq('assistant_id',id).eq('tenant_id',tenantId).maybeSingle();
    if(linkedError) throw linkedError;
    if(linkedAccount){
      res.status(400).json({error:{code:'USE_ACCESS_SETTINGS',message:'استخدم إعدادات صلاحيات المساعد لتعديل حسابه وأجره'}});
      return;
    }
    let pay;
    try { pay = validatePay(req.body, previous); }
    catch (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: (error as Error).message } });
      return;
    }
    const updates: Record<string, any> = {};
    if (name) updates.name = name.trim();
    if (phone) updates.phone = phone.trim();
    if (role_type) updates.role_type = role_type;
    if (group_id !== undefined) {
      updates.group_id = cleanGroupId;
    }
    Object.assign(updates, pay);
    if (status) updates.status = status;

    let updatedAssistant: any = null;

    const { data: directData, error: directErr } = await supabase
      .from("assistants")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select()
      .maybeSingle();

    if (!directErr && directData) {
      updatedAssistant = directData;
    } else if (pay.salary_model === "per_day" || pay.pay_start_date || pay.work_weekdays.length || req.body.pay_start_date !== undefined || req.body.work_weekdays !== undefined) {
      throw directErr || new Error("Failed to save assistant pay schedule");
    } else {
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

      if (!rpcErr && rpcRow) {
        updatedAssistant = rpcRow;
      } else {
        const { data: pubData, error: pubErr } = await supabase
          .from("assistants")
          .update(updates)
          .eq("id", id)
          .eq("tenant_id", tenantId)
          .select()
          .maybeSingle();

        if (pubErr || !pubData) {
          throw new Error(pubErr?.message || rpcErr?.message || directErr?.message || "Failed to update assistant");
        }
        updatedAssistant = pubData;
      }
    }

    res.json({ success: true, assistant: updatedAssistant });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});

// DELETE /api/assistants/:id - Delete an assistant
assistantsRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!canManageAssistants(req)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions to manage assistants" } });
    return;
  }
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
      if (rpcErr) {
        const { error: pubErr } = await supabase
          .from("assistants")
          .delete()
          .eq("id", id)
          .eq("tenant_id", tenantId);
        if (pubErr) throw pubErr;
      }
    }

    res.json({ success: true, message: "تم حذف المساعد بنجاح" });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});
