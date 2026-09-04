import { Router, Request, Response } from "express";
import { getServiceSupabaseClient } from "../../supabase.js";
import { validateBody, internalMessageLogSchema } from "../middleware/validation.js";
import {
  calculateJitterDelay,
  checkWarmUpLimit,
  recordHealthError,
  recordHealthSuccess,
  getHealthStatus,
  validateBusinessProfile,
} from "../../features/whatsapp-notifications/index.js";
import { dispatchSubscriptionRenewalReminders } from "../../features/billing/index.js";

export const internalRouter = Router();

// 1. GET /internal/tenants/:tenant_id/whatsapp-connection
// n8n calls this to fetch connection details and decrypted API key before sending
internalRouter.get(
  "/tenants/:tenant_id/whatsapp-connection",
  async (req: Request, res: Response): Promise<void> => {
    const { tenant_id } = req.params;
    const supabase = getServiceSupabaseClient();

    try {
      const { data, error } = await supabase.rpc("get_tenant_whatsapp_connection", {
        p_tenant_id: tenant_id,
      });

      if (error) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR", message: error.message } });
        return;
      }

      if (!data) {
        res.status(404).json({
          error: { code: "NOT_FOUND", message: "WhatsApp connection not found for this tenant" },
        });
        return;
      }

      res.json({
        provider: data.provider,
        instance_url: data.instance_url,
        instance_status: data.instance_status,
        api_key: data.api_key || null,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);

// 2. POST /internal/message-logs (validated with Zod)
// n8n calls this callback after sending to log outcome and confirm delivery
internalRouter.post(
  "/message-logs",
  validateBody(internalMessageLogSchema),
  async (req: Request, res: Response): Promise<void> => {
    const supabase = getServiceSupabaseClient();
    const {
      tenant_id,
      idempotency_key,
      message_type,
      recipient_type,
      recipient_phone,
      status,
      error_detail,
      student_id,
      group_id,
      session_id,
    } = req.body;

    try {
      // 1. Insert audit log into message_logs
      const { data: logEntry, error: logError } = await supabase
        .from("message_logs")
        .insert({
          tenant_id,
          idempotency_key,
          message_type,
          recipient_type,
          recipient_phone,
          status,
          error_detail: error_detail || null,
          student_id: student_id || null,
          group_id: group_id || null,
          session_id: session_id || null,
        })
        .select()
        .single();

      if (logError) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR", message: logError.message } });
        return;
      }

      // 2. Enforce rule: ONLY mark attendance.sent = true upon confirmed 'sent' delivery
      let attendanceUpdated = false;
      if (status === "sent") {
        const { data: updatedAtt, error: attError } = await supabase
          .from("attendance")
          .update({ sent: true })
          .eq("idempotency_key", idempotency_key)
          .select();

        if (!attError && updatedAtt && updatedAtt.length > 0) {
          attendanceUpdated = true;
        }
      }

      res.status(201).json({
        success: true,
        message_log_id: logEntry.id,
        attendance_confirmed_sent: attendanceUpdated,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);

// DEV-EAH.1 & DEV-EAH.2: GET /internal/tenants/:tenant_id/pacing-delay
// n8n calls this to determine randomized inter-message jitter and warm-up quota
internalRouter.get(
  "/tenants/:tenant_id/pacing-delay",
  async (req: Request, res: Response): Promise<void> => {
    const { tenant_id } = req.params;
    const supabase = getServiceSupabaseClient();

    try {
      const { data: conn } = await supabase
        .from("whatsapp_connections")
        .select("connected_at, is_legacy_exempt")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      // Query today's message count
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("message_logs")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .gte("created_at", `${today}T00:00:00.000Z`);

      const warmUp = checkWarmUpLimit(
        {
          connected_at: conn?.connected_at || new Date().toISOString(),
          is_legacy_exempt: Boolean(conn?.is_legacy_exempt),
        },
        count || 0
      );

      const health = getHealthStatus(tenant_id);
      const delayMs = calculateJitterDelay();

      res.json({
        tenant_id,
        jitter_delay_ms: delayMs,
        warm_up: warmUp,
        health,
        can_send: warmUp.allowed && health.can_send,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);

// DEV-EAH.3: POST /internal/tenants/:tenant_id/health-event
// Records connection disconnects, 429 rate limit errors, or successes from n8n
internalRouter.post("/tenants/:tenant_id/health-event", (req: Request, res: Response): void => {
  const { tenant_id } = req.params;
  const { event_type, error_type } = req.body;

  if (event_type === "success") {
    recordHealthSuccess(tenant_id);
  } else if (event_type === "error") {
    recordHealthError(tenant_id, error_type || "disconnect");
  }

  const status = getHealthStatus(tenant_id);
  res.json({ tenant_id, health: status });
});

// DEV-EAH.4: POST /internal/tenants/:tenant_id/validate-profile
// Validates business profile completeness against anti-spam checklist
internalRouter.post("/tenants/:tenant_id/validate-profile", (req: Request, res: Response): void => {
  const result = validateBusinessProfile(req.body);
  res.json(result);
});

// DEV-SL.4: POST /internal/subscriptions/dispatch-reminders
// Triggered by scheduled cron or n8n to dispatch 5-day and expiry-day renewal reminders
internalRouter.post(
  "/subscriptions/dispatch-reminders",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const summary = await dispatchSubscriptionRenewalReminders();
      res.json({
        message: "Subscription renewal reminders evaluated and dispatched successfully",
        ...summary,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);
