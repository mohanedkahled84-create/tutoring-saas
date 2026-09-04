import { config } from "../config/index.js";
import { getServiceSupabaseClient } from "../supabase.js";
import { logger } from "../utils/logger.js";

export interface AttendanceWebhookPayload {
  tenant_id: string;
  event_type: "attendance_recorded";
  student_id: string;
  student_name: string | null;
  session_id: string;
  attended: boolean;
  comment: string | null;
  parent_phone: string;
  idempotency_key: string;
}

// In-memory cache of dispatched idempotency keys for fast deduplication
const dispatchedKeys = new Set<string>();

/**
 * DEV-WPA.3: Triggers the n8n attendance webhook exactly once per idempotency_key.
 * Operates as a non-blocking asynchronous side effect so attendance recording is never impeded.
 */
export async function dispatchAttendanceWebhook(
  payload: AttendanceWebhookPayload
): Promise<boolean> {
  const { idempotency_key, attended, comment } = payload;

  // 1. Contract Rule: Present students with no comment do not trigger WhatsApp messages
  if (attended === true && (!comment || comment.trim() === "")) {
    logger.info(
      `[WebhookDispatcher] Skipping present student without comment: ${payload.student_name}`
    );
    return false;
  }

  // 2. Exactly-once check: in-memory fast path
  if (dispatchedKeys.has(idempotency_key)) {
    logger.info(
      `[WebhookDispatcher] Webhook already dispatched for key (in-memory): ${idempotency_key}`
    );
    return false;
  }

  // 3. Exactly-once check: persistent check against message_logs
  try {
    const supabase = getServiceSupabaseClient();
    const { data: existingLog } = await supabase
      .from("message_logs")
      .select("id")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existingLog) {
      dispatchedKeys.add(idempotency_key);
      logger.info(
        `[WebhookDispatcher] Webhook already logged in database for key: ${idempotency_key}`
      );
      return false;
    }
  } catch (err: any) {
    logger.warn(
      `[WebhookDispatcher] Database deduplication check failed, proceeding cautiously: ${err.message}`
    );
  }

  // Mark dispatched immediately to prevent race conditions
  dispatchedKeys.add(idempotency_key);

  const webhookUrl = process.env.N8N_ATTENDANCE_WEBHOOK_URL;

  // If no webhook URL is configured (e.g. local dev / test), log gracefully
  if (!webhookUrl) {
    logger.info(
      `[WebhookDispatcher] [SIMULATED] n8n webhook triggered for ${payload.student_name} (${idempotency_key})`
    );
    return true;
  }

  // 4. Send HTTP POST to n8n webhook
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": config.internalApiSecret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000), // 8s timeout
    });

    if (!response.ok) {
      logger.warn(
        `[WebhookDispatcher] n8n returned non-200 status (${response.status}) for ${idempotency_key}`
      );
      return false;
    }

    logger.info(
      `[WebhookDispatcher] Webhook successfully delivered to n8n for ${payload.student_name} (${idempotency_key})`
    );
    return true;
  } catch (err: any) {
    // Non-blocking: never crash or throw to the caller
    logger.error(
      `[WebhookDispatcher] Failed to dispatch webhook to n8n for ${idempotency_key}: ${err.message}`
    );
    return false;
  }
}
