import crypto from "node:crypto";
import { config } from "../../shared/config/index.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { logger } from "../../shared/utils/logger.js";
import {
  CriticalErrorAlertPayload,
  CriticalErrorAlertResult,
} from "./types.js";

// Rate limiting & deduplication cache (fingerprint -> metadata)
interface DedupEntry {
  lastSentAt: number;
  suppressedCount: number;
}

const alertDedupCache = new Map<string, DedupEntry>();
export const DEFAULT_ALERT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export function clearAlertDeduplicationCache(): void {
  alertDedupCache.clear();
}

/**
 * Computes deterministic fingerprint for an error to group identical issues.
 */
export function computeErrorFingerprint(payload: CriticalErrorAlertPayload): string {
  const normalizedMessage = (payload.error_message || "")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\d+/g, ":n")
    .trim();

  const key = `${payload.error_name}:${normalizedMessage}:${payload.context?.path || ""}`;
  return crypto.createHash("md5").update(key).digest("hex");
}

/**
 * Formats critical alert email content.
 */
export function formatCriticalAlertEmail(
  payload: CriticalErrorAlertPayload,
  suppressedCount = 0
): { subject: string; html: string; text: string } {
  const timestamp = payload.occurred_at || new Date().toISOString();
  const cairoTime = new Date(timestamp).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" });
  const subject = `🚨 [CRITICAL ALERT] Centrly Incident: ${payload.error_name}`;

  const stackSnippet = payload.stack
    ? payload.stack.split("\n").slice(0, 6).join("\n")
    : "No stack trace available";

  const text = [
    `🚨 CENTRLY CRITICAL OPS ALERT`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Environment: ${config.nodeEnv.toUpperCase()}`,
    `Severity: ${payload.severity || "CRITICAL"}`,
    `Timestamp: ${cairoTime} (${timestamp})`,
    `Error Name: ${payload.error_name}`,
    `Error Message: ${payload.error_message}`,
    payload.context?.path ? `Endpoint: ${payload.context.method || "GET"} ${payload.context.path}` : null,
    payload.context?.request_id ? `Request ID: ${payload.context.request_id}` : null,
    payload.context?.tenant_id ? `Tenant ID: ${payload.context.tenant_id}` : null,
    payload.context?.ip ? `IP Address: ${payload.context.ip}` : null,
    suppressedCount > 0
      ? `⚠️ Note: ${suppressedCount} duplicate occurrences were suppressed during the cooldown window.`
      : null,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Stack Trace:`,
    stackSnippet,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; background: #fdf2f2; padding: 24px; border-radius: 8px; border: 1px solid #f87171;">
      <h2 style="color: #b91c1c; margin-top: 0;">🚨 Centrly Ops Alert: ${payload.error_name}</h2>
      <p style="font-size: 14px; color: #374151;">A critical error or unhandled failure occurred in production.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #fff; border-radius: 4px; overflow: hidden;">
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 8px 12px; font-weight: bold; width: 140px;">Severity:</td>
          <td style="padding: 8px 12px; color: #dc2626; font-weight: bold;">${payload.severity || "CRITICAL"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 8px 12px; font-weight: bold;">Environment:</td>
          <td style="padding: 8px 12px;">${config.nodeEnv}</td>
        </tr>
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 8px 12px; font-weight: bold;">Time (Cairo):</td>
          <td style="padding: 8px 12px;">${cairoTime}</td>
        </tr>
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 8px 12px; font-weight: bold;">Error Message:</td>
          <td style="padding: 8px 12px; color: #111827; font-family: monospace;">${payload.error_message}</td>
        </tr>
        ${payload.context?.path ? `
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 8px 12px; font-weight: bold;">Request:</td>
          <td style="padding: 8px 12px; font-family: monospace;">${payload.context.method || "GET"} ${payload.context.path}</td>
        </tr>` : ""}
        ${payload.context?.request_id ? `
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 8px 12px; font-weight: bold;">Request ID:</td>
          <td style="padding: 8px 12px; font-family: monospace;">${payload.context.request_id}</td>
        </tr>` : ""}
      </table>

      ${suppressedCount > 0 ? `
        <div style="background: #fef3c7; color: #92400e; padding: 8px 12px; border-radius: 4px; margin-bottom: 16px; font-size: 13px;">
          ⚠️ <b>Rate Limit Dedup:</b> ${suppressedCount} duplicate events were suppressed during cooldown.
        </div>` : ""}

      <h4 style="color: #374151; margin-bottom: 6px;">Stack Trace (Top Frames):</h4>
      <pre style="background: #1f2937; color: #f9fafb; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto;">${stackSnippet}</pre>
    </div>
  `;

  return { subject, html, text };
}

/**
 * DEV-51: Dispatch email alert to founder for critical errors.
 * Includes rate limiting, deduplication, and message_logs auditing.
 */
export async function dispatchCriticalErrorAlert(
  payload: CriticalErrorAlertPayload,
  options?: {
    cooldownMs?: number;
    customSender?: (subject: string, text: string, html: string) => Promise<boolean>;
  }
): Promise<CriticalErrorAlertResult> {
  const recipientEmail = config.founderEmail;
  const cooldownMs = options?.cooldownMs ?? DEFAULT_ALERT_COOLDOWN_MS;
  const fingerprint = computeErrorFingerprint(payload);

  // 1. Severity filter: Only CRITICAL and WARNING page the founder (avoid alert fatigue)
  if (payload.severity === "INFO") {
    return {
      dispatched: false,
      suppressed: true,
      reason: "INFO severity does not trigger ops alerts",
      fingerprint,
      recipient_email: recipientEmail,
      subject: "",
    };
  }

  // 2. Deduplication and rate-limiting check
  const now = Date.now();
  const existingEntry = alertDedupCache.get(fingerprint);

  if (existingEntry) {
    const elapsed = now - existingEntry.lastSentAt;
    if (elapsed < cooldownMs) {
      existingEntry.suppressedCount += 1;
      logger.warn(
        `[OpsAlert] Suppressed duplicate critical alert (${fingerprint}) - occurrence #${existingEntry.suppressedCount}`
      );
      return {
        dispatched: false,
        suppressed: true,
        reason: `Suppressed by cooldown (${Math.round((cooldownMs - elapsed) / 1000)}s remaining)`,
        fingerprint,
        recipient_email: recipientEmail,
        subject: "",
        suppressed_count: existingEntry.suppressedCount,
      };
    }
  }

  const suppressedCount = existingEntry ? existingEntry.suppressedCount : 0;
  alertDedupCache.set(fingerprint, { lastSentAt: now, suppressedCount: 0 });

  const { subject, html, text } = formatCriticalAlertEmail(payload, suppressedCount);

  // 3. Dispatch Email
  let emailDispatched = false;
  try {
    if (options?.customSender) {
      emailDispatched = await options.customSender(subject, text, html);
    } else if (config.resendApiKey && config.resendApiKey.length > 5) {
      // Dispatches via Resend transactional email API
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "alerts@centrly.app",
          to: recipientEmail,
          subject,
          html,
          text,
        }),
      });
      emailDispatched = res.ok;
    } else {
      // Dev / Test mode fallback
      logger.info(`[OpsAlert] Mock email dispatched to ${recipientEmail}: ${subject}`);
      emailDispatched = true;
    }
  } catch (emailErr: unknown) {
    logger.error("[OpsAlert] Failed to deliver alert email:", emailErr);
  }

  // 4. Audit in message_logs
  try {
    const supabase = getServiceSupabaseClient();
    const idempotencyKey = `ops_alert:${fingerprint}:${now}`;

    await supabase.from("message_logs").insert({
      tenant_id: payload.context?.tenant_id || null,
      idempotency_key: idempotencyKey,
      message_type: "critical_error_email_alert",
      recipient_type: "system",
      recipient_phone: recipientEmail,
      status: emailDispatched ? "sent" : "failed",
      error_detail: text,
    });
  } catch (auditErr: unknown) {
    logger.error("[OpsAlert] Failed to audit alert in message_logs:", auditErr);
  }

  return {
    dispatched: emailDispatched,
    suppressed: false,
    fingerprint,
    recipient_email: recipientEmail,
    subject,
    suppressed_count: suppressedCount,
  };
}
