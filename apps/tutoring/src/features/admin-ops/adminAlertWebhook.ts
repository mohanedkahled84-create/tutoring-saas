import { config } from "../../shared/config/index.js";
import { logger } from "../../shared/utils/logger.js";

export interface NewSignupWebhookPayload {
  event_type: "new_signup";
  teacher_name: string;
  teacher_email: string;
  teacher_phone?: string;
  tenant_name: string;
  account_type?: "teacher" | "center";
  subject?: string;
  governorate?: string;
  trial_ends_at?: string;
  created_at?: string;
}

export interface PaymentProofWebhookPayload {
  event_type: "payment_proof_submitted";
  teacher_name?: string;
  tenant_name?: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  proof_image_url?: string;
  admin_notes?: string;
  admin_dashboard_url?: string;
  created_at?: string;
}

export interface TrialReminderWebhookPayload {
  event_type: "trial_reminder";
  teacher_name?: string;
  teacher_phone: string;
  tenant_name?: string;
  threshold: "5_days_before" | "expiry_day";
  message?: string;
  expiry_date?: string;
}

export type AdminAlertPayload =
  | NewSignupWebhookPayload
  | PaymentProofWebhookPayload
  | TrialReminderWebhookPayload;

/**
 * Dispatches an event to the n8n Admin Alert Webhook asynchronously (non-blocking).
 */
export async function dispatchAdminAlertWebhook(
  payload: AdminAlertPayload,
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  const webhookUrl =
    process.env.N8N_ADMIN_ALERT_WEBHOOK_URL || (config as any).n8nAdminAlertWebhookUrl || "";

  if (!webhookUrl) {
    logger.info("[AdminAlertWebhook] Webhook URL not configured, skipping dispatch.");
    return false;
  }

  try {
    const res = await fetchFn(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      logger.warn(`[AdminAlertWebhook] Webhook returned status ${res.status}`);
      return false;
    }

    logger.info(`[AdminAlertWebhook] Dispatched event: ${payload.event_type}`);
    return true;
  } catch (err: unknown) {
    logger.error(`[AdminAlertWebhook] Error dispatching webhook: ${(err as Error).message}`);
    return false;
  }
}
