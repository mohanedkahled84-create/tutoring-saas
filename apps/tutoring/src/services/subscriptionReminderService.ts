import { getServiceSupabaseClient } from "../supabase.js";
import { logger } from "../utils/logger.js";

export interface ReminderResult {
  tenant_id: string;
  tenant_name: string;
  threshold: "5_days_before" | "expiry_day";
  idempotency_key: string;
  status: "dispatched" | "already_sent" | "failed";
  error?: string;
}

export interface DispatchRemindersSummary {
  evaluated_tenants: number;
  reminders_dispatched: number;
  reminders_skipped_already_sent: number;
  results: ReminderResult[];
}

// DEV-SL.4: Scheduled Subscription Renewal Reminder Dispatcher
// Evaluates expiring subscriptions and dispatches reminders exactly once per threshold
export async function dispatchSubscriptionRenewalReminders(): Promise<DispatchRemindersSummary> {
  const supabase = getServiceSupabaseClient();
  const now = new Date();

  const results: ReminderResult[] = [];
  let dispatchedCount = 0;
  let skippedCount = 0;

  try {
    // 1. Fetch tenants with active or trial subscriptions
    const { data: tenants, error } = await supabase
      .from("tenants")
      .select("id, name, subscription_status, trial_ends_at, subscription_ends_at")
      .in("subscription_status", ["active", "trial", "past_due"])
      .is("deleted_at", null);

    if (error || !tenants) {
      logger.error("[SubscriptionReminder] Failed to query tenants for renewal reminders", error);
      return {
        evaluated_tenants: 0,
        reminders_dispatched: 0,
        reminders_skipped_already_sent: 0,
        results: [],
      };
    }

    for (const tenant of tenants) {
      const expiryDateStr = tenant.subscription_ends_at || tenant.trial_ends_at;
      if (!expiryDateStr) continue;

      const expiryDate = new Date(expiryDateStr);
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = Math.ceil(diffHours / 24);

      let threshold: "5_days_before" | "expiry_day" | null = null;

      // Threshold 1: 5 days before (between 4 and 5 days remaining)
      if (diffDays >= 4 && diffDays <= 5) {
        threshold = "5_days_before";
      }
      // Threshold 2: Day of expiry (less than 24 hours or expired today)
      else if (diffHours <= 24 && diffHours >= -24) {
        threshold = "expiry_day";
      }

      if (!threshold) continue;

      // Unique deterministic key ensuring exactly-once execution per threshold
      const expiryDateBucket = expiryDateStr.split("T")[0];
      const idempotencyKey = `${tenant.id}:renewal_reminder:${threshold}:${expiryDateBucket}`;

      // 2. Persistent check: has this reminder already been logged for this threshold?
      const { data: existingLog } = await supabase
        .from("message_logs")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingLog) {
        skippedCount += 1;
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          threshold,
          idempotency_key: idempotencyKey,
          status: "already_sent",
        });
        continue;
      }

      // 3. Find tenant owner contact phone/email
      const { data: ownerUser } = await supabase
        .from("users")
        .select("email, phone")
        .eq("tenant_id", tenant.id)
        .eq("role", "owner")
        .maybeSingle();

      const recipientPhone = ownerUser?.phone || "01000000000";

      const formattedMessage =
        threshold === "5_days_before"
          ? [
              `⏰ *تذكير باقتراب موعد تجديد الاشتراك*`,
              `أهلاً بك أستاذنا في منصة إدارة الدروس (${tenant.name})،`,
              `نود تذكيركم بأن اشتراككم الحالي سينتهي خلال *5 أيام* بتاريخ: ${expiryDate.toLocaleDateString("ar-EG")}.`,
              `لضمان استمرار عمل مسح الباركود وإرسال رسائل الواتساب لأولياء الأمور دون انقطاع، يرجى التجديد عبر تحويل قيمة الاشتراك (InstaPay / Vodafone Cash) ورفع إيصال التحويل من لوحة التحكم:`,
              `🔗 رابط رفع الإيصال: /api/billing/payment-proof`,
            ].join("\n")
          : [
              `🚨 *تنبيه: اشتراكك ينتهي اليوم!*`,
              `أهلاً بك أستاذنا في منصة إدارة الدروس (${tenant.name})،`,
              `نلفت انتباهكم إلى أن اليوم هو الموعد الأخير لاشتراككم الحالي (${expiryDate.toLocaleDateString("ar-EG")}).`,
              `لتجنب تعليق إدخال درجات الطلاب وإرسال الإشعارات، يرجى سداد الاشتراك وإرفاق صورة التحويل اليوم.`,
              `🔗 رابط رفع الإيصال: /api/billing/payment-proof`,
            ].join("\n");

      // 4. Log reminder into message_logs
      const { error: insertErr } = await supabase.from("message_logs").insert({
        tenant_id: tenant.id,
        idempotency_key: idempotencyKey,
        message_type: "renewal_reminder",
        recipient_type: "owner",
        recipient_phone: recipientPhone,
        status: "needs_review",
        error_detail: formattedMessage,
      });

      if (insertErr) {
        logger.error(
          `[SubscriptionReminder] Failed to log reminder for ${tenant.name}: ${insertErr.message}`
        );
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          threshold,
          idempotency_key: idempotencyKey,
          status: "failed",
          error: insertErr.message,
        });
      } else {
        dispatchedCount += 1;
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          threshold,
          idempotency_key: idempotencyKey,
          status: "dispatched",
        });
        logger.info(
          `[SubscriptionReminder] Logged ${threshold} reminder for ${tenant.name} (${idempotencyKey})`
        );
      }
    }

    return {
      evaluated_tenants: tenants.length,
      reminders_dispatched: dispatchedCount,
      reminders_skipped_already_sent: skippedCount,
      results,
    };
  } catch (err: any) {
    logger.error("[SubscriptionReminder] Exception in reminder dispatcher", err);
    return {
      evaluated_tenants: 0,
      reminders_dispatched: 0,
      reminders_skipped_already_sent: 0,
      results: [],
    };
  }
}
