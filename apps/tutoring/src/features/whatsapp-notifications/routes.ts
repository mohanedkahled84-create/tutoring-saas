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

whatsappRouter.get("/status", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const service = resolveWhatsAppService(req);
  const status = await service.getConnectionStatus(req.user?.tenant_id || undefined);
  res.json(status);
});

whatsappRouter.post(
  "/test",
  validateBody(testMessageSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { phone, message } = req.body;
    res.json({
      success: true,
      recipient: phone,
      message: message || "رسالة اختبارية من منصة الأستاذ الذكي - الاتصال يعمل بنجاح!",
      sent_at: new Date().toISOString(),
    });
  }
);

whatsappRouter.post(
  "/disconnect",
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({
      success: true,
      message: "WhatsApp instance disconnected. Scan QR to reconnect.",
    });
  }
);

whatsappRouter.get("/qr", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({
    pairing_code: "2@fake-evolution-api-qr-code-string-for-whatsapp-web",
    expires_in_seconds: 30,
  });
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
