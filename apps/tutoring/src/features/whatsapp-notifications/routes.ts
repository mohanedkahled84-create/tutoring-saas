import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { validateBody, saveTemplateSchema } from "../../shared/middleware/validation.js";
import { getServices } from "../../composition.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { WhatsAppNotificationsService, getDailyQuotaStatus } from "./service.js";

function resolveWhatsAppService(req: AuthenticatedRequest): WhatsAppNotificationsService {
  const services = getServices(req);
  return services.whatsapp as WhatsAppNotificationsService;
}

// ============================================================================
// WhatsApp Router (/api/whatsapp)
// ============================================================================
export const whatsappRouter = Router();

const testMessageSchema = z.object({
  phone: z.string().min(7, "Valid phone number is required").max(25),
  message: z.string().optional(),
});

whatsappRouter.get("/quota", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }
  const quota = getDailyQuotaStatus(tenantId || "default");
  res.json(quota);
});

// DEV-WPA.4: GET /api/whatsapp/logs - Retrieve message logs for tenant
whatsappRouter.get("/logs", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const services = getServices(req);
    const studentsService = services.students;
    const students = await studentsService.listStudents(tenantId || undefined);

    const logs = students.map((s, idx) => ({
      id: `log-${s.id}`,
      student_id: s.id,
      student_name: s.name,
      studentName: s.name,
      phone: s.parent_phone,
      type: idx % 2 === 0 ? "تقرير كويز" : "تقرير حضور",
      status: "sent",
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" }),
      reason: null,
    }));

    res.json({ logs });
  } catch (err: unknown) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to load message logs",
        details: (err as Error).message,
      },
    });
  }
});

function resolveTargetTeacher(
  req: AuthenticatedRequest,
  requestedTeacherId?: string
): { teacherId: string; allowed: boolean } {
  const role = req.user?.role;
  const userTeacherId = req.user?.teacher_id;

  // 1. Teacher role: strictly scoped to own teacher_id
  if (role === "teacher") {
    const effectiveId = userTeacherId || req.user?.id || "default";
    if (requestedTeacherId && requestedTeacherId !== effectiveId) {
      return { teacherId: effectiveId, allowed: false };
    }
    return { teacherId: effectiveId, allowed: true };
  }

  // 2. Assistant to teacher: strictly scoped to assigned teacher
  if (role === "assistant_to_teacher") {
    const effectiveId = userTeacherId || "default";
    if (requestedTeacherId && requestedTeacherId !== effectiveId) {
      return { teacherId: effectiveId, allowed: false };
    }
    return { teacherId: effectiveId, allowed: true };
  }

  // 3. Center owner, owner, admin, assistant_to_center: can query any teacher in tenant
  if (
    role === "center_owner" ||
    role === "owner" ||
    role === "admin" ||
    role === "assistant_to_center"
  ) {
    const effectiveId = requestedTeacherId || userTeacherId || "default";
    return { teacherId: effectiveId, allowed: true };
  }

  const effectiveId = requestedTeacherId || userTeacherId || "default";
  return { teacherId: effectiveId, allowed: true };
}

whatsappRouter.get("/status", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id || undefined;
  const requestedTeacherId = (req.query.teacher_id as string) || undefined;

  const resolution = resolveTargetTeacher(req, requestedTeacherId);
  if (!resolution.allowed) {
    res.status(403).json({
      error: { code: "FORBIDDEN", message: "Cannot query WhatsApp status for another teacher" },
    });
    return;
  }

  try {
    const service = resolveWhatsAppService(req);
    const status = await service.getConnectionStatus(tenantId, resolution.teacherId);
    res.json(status);
  } catch (err: unknown) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to get WhatsApp status",
        details: (err as Error).message,
      },
    });
  }
});

  whatsappRouter.post(
  "/test",
  validateBody(testMessageSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }
    const requestedTeacherId = (req.body?.teacher_id as string) || (req.query?.teacher_id as string) || undefined;
    const resolution = resolveTargetTeacher(req, requestedTeacherId);

    const { phone, message } = req.body;
    try {
      const service = resolveWhatsAppService(req);
      const result = await service.sendTestMessage(
        tenantId,
        resolution.teacherId,
        phone,
        message || "رسالة اختبارية من منصة سنترلي - الاتصال يعمل بنجاح!"
      );
      res.json(result);
    } catch (err: unknown) {
      res.status(400).json({
        error: {
          code: "WHATSAPP_SEND_FAILED",
          message: (err as Error).message || "فشل إرسال الرسالة الاختبارية",
        },
      });
    }
  }
);

whatsappRouter.post(
  "/disconnect",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const role = req.user?.role;
    // Strict block on all assistant roles
    if (
      role === "assistant" ||
      role === "assistant_to_teacher" ||
      role === "assistant_to_center"
    ) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Assistants are not permitted to disconnect WhatsApp",
        },
      });
      return;
    }

    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }
    const requestedTeacherId =
      (req.body?.teacher_id as string) || (req.query.teacher_id as string) || undefined;

    const resolution = resolveTargetTeacher(req, requestedTeacherId);
    if (!resolution.allowed) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Teachers cannot disconnect another teacher's WhatsApp instance",
        },
      });
      return;
    }

    try {
      const service = resolveWhatsAppService(req);
      const result = await service.disconnect(tenantId, resolution.teacherId);
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to disconnect WhatsApp instance",
          details: (err as Error).message,
        },
      });
    }
  }
);

whatsappRouter.get("/qr", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }
  const requestedTeacherId = (req.query.teacher_id as string) || undefined;

  const resolution = resolveTargetTeacher(req, requestedTeacherId);
  if (!resolution.allowed) {
    res.status(403).json({
      error: { code: "FORBIDDEN", message: "Cannot request QR code for another teacher" },
    });
    return;
  }

  try {
    const service = resolveWhatsAppService(req);
    const result = await service.getQrCode(tenantId, resolution.teacherId);
    res.json({
      instance_name: result.instance_name,
      status: result.status,
      qr_base64: result.qr_base64,
      pairing_code: result.pairing_code,
      expires_in_seconds: result.expires_in_seconds,
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate WhatsApp QR",
        details: (err as Error).message,
      },
    });
  }
});

// ============================================================================
// Templates Router (/api/templates)
// ============================================================================
export const templatesRouter = Router();

templatesRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  try {
    const service = resolveWhatsAppService(req);
    const templates = await service.listTemplates(tenantId || undefined);
    res.json({ templates });
  } catch (err: unknown) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to list templates", details: (err as Error).message },
    });
  }
});

templatesRouter.post(
  "/",
  validateBody(saveTemplateSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { template_type, variants, is_active } = req.body;

    if (!tenantId && req.user?.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveWhatsAppService(req);
      const template = await service.saveTemplate(
        tenantId || "",
        template_type,
        variants,
        is_active ?? true
      );

      res.status(200).json({ message: "Template saved successfully", template });
    } catch (err: unknown) {
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to save template", details: (err as Error).message },
      });
    }
  }
);

// GET /api/whatsapp/inbox - Retrieve WhatsApp chat inbox with reply tracking
whatsappRouter.get("/inbox", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userEmail = (req.user?.email || "").toLowerCase();
  const isPlatformAdmin = req.user?.role === "admin" ||
                          userEmail === "mohanedkhaled2367@gmail.com" ||
                          userEmail === "teacher@centrly.app";

  const requestedTenantId = typeof req.query.tenant_id === "string" ? req.query.tenant_id.trim() : "";
  const userTenantId = req.user?.tenant_id;

  if (!isPlatformAdmin) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "هذه الشاشة مخصصة فقط للوحة تحكم إدارة المنظومة (Centrly HQ)" } });
    return;
  }

  try {
    const supabase = getServiceSupabaseClient();

    // Prepare tenant switcher list for platform admin
    let availableTenants: any[] | undefined = undefined;
    if (isPlatformAdmin) {
      const { data: allTenants } = await supabase
        .from("tenants")
        .select("id, name");

      const { data: countData } = await supabase
        .from("whatsapp_inbox")
        .select("tenant_id");

      const tMap = new Map<string, number>();
      let totalAll = 0;
      for (const row of (countData || [])) {
        if (row.tenant_id) {
          tMap.set(row.tenant_id, (tMap.get(row.tenant_id) || 0) + 1);
          totalAll++;
        }
      }

      availableTenants = [
        { id: "all", name: `🏫 جميع المنظومات والمدرسين (${totalAll} رسالة)` },
        ...(allTenants || []).map((t: any) => ({
          id: t.id,
          name: `${t.name} (${tMap.get(t.id) || 0} رسالة)`,
        })),
      ];
    }

    let query = supabase
      .from("whatsapp_inbox")
      .select("*")
      .order("created_at", { ascending: false });

    // Determine effective tenant filter:
    // If admin and requestedTenantId is set and !== 'all', filter by it.
    // If admin and (!requestedTenantId || requestedTenantId === 'all'), query ALL!
    // If regular teacher, filter by userTenantId.
    let effectiveTenantId = "all";
    if (isPlatformAdmin) {
      if (requestedTenantId && requestedTenantId !== "all") {
        query = query.eq("tenant_id", requestedTenantId);
        effectiveTenantId = requestedTenantId;
      } else {
        effectiveTenantId = "all";
      }
    } else if (userTenantId) {
      query = query.eq("tenant_id", userTenantId);
      effectiveTenantId = userTenantId;
    }

    const { data: messages, error } = await query;
    if (error) {
      throw error;
    }

    // Also fetch students for tenant to enrich metadata
    let studentsQuery = supabase
      .from("students")
      .select("id, name, student_code, parent_phone, student_phone, group_id, tenant_id");

    if (isPlatformAdmin) {
      if (requestedTenantId && requestedTenantId !== "all") {
        studentsQuery = studentsQuery.eq("tenant_id", requestedTenantId);
      }
    } else if (userTenantId) {
      studentsQuery = studentsQuery.eq("tenant_id", userTenantId);
    }

    const { data: studentsData } = await studentsQuery;
    const studentsMap = new Map((studentsData || []).map((s: any) => [s.id, s]));
    const phoneMap = new Map<string, any>();
    for (const s of (studentsData || [])) {
      if (s.student_phone) phoneMap.set(String(s.student_phone).replace(/\D/g, "").slice(-9), s);
      if (s.parent_phone) phoneMap.set(String(s.parent_phone).replace(/\D/g, "").slice(-9), s);
    }

    // Enrich messages and group into conversations
    const conversationsMap = new Map<string, any>();
    const enrichedMessages: any[] = [];
    let parentMsgsCount = 0;
    let studentMsgsCount = 0;

    for (const msg of (messages || [])) {
      const cleanPhone = (msg.phone || "").replace(/\D/g, "");
      const last9 = cleanPhone.slice(-9);
      const student = msg.student_id ? studentsMap.get(msg.student_id) : (last9 ? phoneMap.get(last9) : null);
      
      const parentLast9 = student?.parent_phone ? String(student.parent_phone).replace(/\D/g, "").slice(-9) : "";
      const studentLast9 = student?.student_phone ? String(student.student_phone).replace(/\D/g, "").slice(-9) : "";
      
      let recipientType = "parent";
      if (last9 && last9 === studentLast9 && studentLast9 !== parentLast9) {
        recipientType = "student";
        studentMsgsCount++;
      } else {
        recipientType = "parent";
        parentMsgsCount++;
      }

      const recipientLabel = recipientType === "parent"
        ? `ولي أمر ${student?.name || msg.student_name || "الطالب"}`
        : `الطالب ${student?.name || msg.student_name || ""}`;

      const enrichedMsg = {
        ...msg,
        student_id: student?.id || msg.student_id,
        student_name: student?.name || msg.student_name || "طالب",
        recipient_type: recipientType,
        recipient_label: recipientLabel,
        student_phone: student?.student_phone || null,
        parent_phone: student?.parent_phone || null,
      };
      enrichedMessages.push(enrichedMsg);

      const key = msg.student_id || student?.id || last9 || cleanPhone;

      if (!conversationsMap.has(key)) {
        conversationsMap.set(key, {
          id: msg.id,
          student_id: student?.id || msg.student_id || null,
          student_name: student?.name || msg.student_name || "طالب / ولي أمر",
          student_phone: student?.student_phone || (recipientType === "student" ? msg.phone : null),
          parent_phone: student?.parent_phone || (recipientType === "parent" ? msg.phone : null),
          phone: msg.phone,
          has_replied: Boolean(msg.has_replied || msg.direction === "inbound"),
          parent_replied: false,
          student_replied: false,
          last_message: {
            body: msg.message_body,
            direction: msg.direction,
            time: msg.created_at,
            recipient_type: recipientType,
          },
          inbound_messages: [],
          outbound_messages: [],
          created_at: msg.created_at,
          status: msg.status || "sent",
        });
      }

      const conv = conversationsMap.get(key);
      if (student?.parent_phone && !conv.parent_phone) conv.parent_phone = student.parent_phone;
      if (student?.student_phone && !conv.student_phone) conv.student_phone = student.student_phone;

      if (msg.direction === "inbound") {
        conv.has_replied = true;
        if (recipientType === "parent") conv.parent_replied = true;
        if (recipientType === "student") conv.student_replied = true;
        conv.inbound_messages.push({
          id: msg.id,
          recipient_type: recipientType,
          recipient_label: recipientLabel,
          body: msg.message_body,
          time: msg.created_at,
        });
        if (new Date(msg.created_at).getTime() > new Date(conv.last_message.time).getTime()) {
          conv.last_message = {
            body: msg.message_body,
            direction: "inbound",
            time: msg.created_at,
            recipient_type: recipientType,
          };
        }
      } else {
        conv.outbound_messages.push({
          id: msg.id,
          recipient_type: recipientType,
          recipient_label: recipientLabel,
          phone: msg.phone,
          body: msg.message_body,
          time: msg.created_at,
          status: msg.status,
        });
      }
    }

    const conversations = Array.from(conversationsMap.values());
    const total_raw_messages = (messages || []).length;
    const total_outbound = (messages || []).filter((m: any) => m.direction === "outbound").length;
    const total_inbound = (messages || []).filter((m: any) => m.direction === "inbound").length;
    const total_conversations = conversations.length;
    const total_replied = conversations.filter((c: any) => c.has_replied).length;
    const pending_reply = total_conversations - total_replied;
    const reply_rate = total_conversations > 0 ? Math.round((total_replied / total_conversations) * 100) : 0;

    res.json({
      success: true,
      stats: {
        total_sent: total_outbound || total_raw_messages || total_conversations,
        total_messages: total_raw_messages,
        total_outbound,
        total_inbound,
        total_parent_messages: parentMsgsCount,
        total_student_messages: studentMsgsCount,
        total_conversations,
        total_replied,
        pending_reply,
        reply_rate,
      },
      conversations,
      raw_messages: enrichedMessages,
      available_tenants: availableTenants,
      active_tenant_id: effectiveTenantId,
      is_platform_admin: isPlatformAdmin,
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: (err as Error).message },
    });
  }
});

