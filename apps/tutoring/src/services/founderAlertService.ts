import { config } from "../config/index.js";
import { getServiceSupabaseClient } from "../supabase.js";
import { logger } from "../utils/logger.js";

export interface NewSignupPayload {
  teacher_name: string;
  teacher_email: string;
  teacher_phone?: string;
  tenant_name: string;
  subject?: string;
  governorate?: string;
  trial_ends_at?: string;
}

// DEV-SA.1: Dispatch founder alert asynchronously without blocking signup flow
export async function alertFounderOfNewSignup(payload: NewSignupPayload): Promise<void> {
  try {
    const supabase = getServiceSupabaseClient();
    const signupTime = new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" });

    const formattedMessage = [
      "🚀 *تسجيل معلم جديد في المنصة!*",
      `👤 *المعلم:* ${payload.teacher_name}`,
      `📧 *البريد:* ${payload.teacher_email}`,
      `📱 *الهاتف:* ${payload.teacher_phone || "غير مسجل"}`,
      `🏫 *المركز/المؤسسة:* ${payload.tenant_name}`,
      payload.subject ? `📚 *المادة:* ${payload.subject}` : null,
      payload.governorate ? `📍 *المحافظة:* ${payload.governorate}` : null,
      `⏰ *تاريخ التسجيل:* ${signupTime}`,
      `⏳ *انتهاء التجربة:* ${payload.trial_ends_at || "14 يوماً"}`,
      "⭐ *حالة الحساب:* تجربة مجانية (Trial)",
    ]
      .filter(Boolean)
      .join("\n");

    const idempotencyKey = `founder_alert:${payload.teacher_email}:${Date.now()}`;

    // 1. Audit in message_logs
    await supabase.from("message_logs").insert({
      tenant_id: null,
      idempotency_key: idempotencyKey,
      message_type: "founder_signup_alert",
      recipient_type: "system",
      recipient_phone: config.founderPhone,
      status: "needs_review",
      error_detail: formattedMessage,
    });

    logger.info(`[FounderAlert] Logged new signup alert for founder: ${payload.teacher_name} (${payload.teacher_email})`);
  } catch (err: any) {
    // Non-blocking: log error and let signup proceed normally
    logger.error("[FounderAlert] Failed to log founder signup alert (non-blocking)", err);
  }
}
