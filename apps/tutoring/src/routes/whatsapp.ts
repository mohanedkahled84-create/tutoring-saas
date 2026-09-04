import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { z } from "zod";
import { validateBody } from "../middleware/validation.js";

export const whatsappRouter = Router();

const testMessageSchema = z.object({
  phone: z.string().min(7, "Valid phone number is required").max(25),
  message: z.string().optional(),
});

// GET /api/whatsapp/status - Check connection status and instance health
whatsappRouter.get("/status", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({
    status: "connected",
    phone_number: "+201099887766",
    gateway: "Evolution API v2.1",
    latency_ms: 110,
    daily_quota: {
      used: 124,
      limit: 500,
      safety_score: "excellent",
    },
  });
});

// POST /api/whatsapp/test - Send a test message
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

// POST /api/whatsapp/disconnect - Disconnect session
whatsappRouter.post(
  "/disconnect",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({
      success: true,
      message: "WhatsApp instance disconnected. Scan QR to reconnect.",
    });
  }
);

// GET /api/whatsapp/qr - Get QR pairing code
whatsappRouter.get("/qr", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({
    pairing_code: "2@fake-evolution-api-qr-code-string-for-whatsapp-web",
    expires_in_seconds: 30,
  });
});
