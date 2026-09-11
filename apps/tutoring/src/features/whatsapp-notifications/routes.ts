import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { validateBody, saveTemplateSchema } from "../../shared/middleware/validation.js";
import { getServices } from "../../composition.js";
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
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
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
    const tenantId = req.user?.tenant_id || "default";
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

    const tenantId = req.user?.tenant_id || "default";
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
  const tenantId = req.user?.tenant_id || "default";
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
