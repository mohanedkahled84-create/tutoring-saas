import { logger } from "../../shared/utils/logger.js";
import {
  IBillingRepository,
  PaymentProofInput,
  PaymentProofRecord,
  TenantBillingStatus,
  DispatchRemindersSummary,
  ReminderResult,
} from "./types.js";

/**
 * Pure calculation helper to determine days remaining on subscription or trial
 */
export function calculateDaysRemaining(
  subscriptionStatus: string,
  trialEndsAt?: string | null,
  subscriptionEndsAt?: string | null,
  now: Date = new Date()
): number {
  const targetDateStr =
    subscriptionStatus === "trial" ? trialEndsAt : subscriptionEndsAt;

  if (!targetDateStr) {
    return 0;
  }

  const ms = new Date(targetDateStr).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export class BillingService {
  constructor(private readonly repository: IBillingRepository) {}

  /**
   * Records payment proof and updates tenant subscription to 'pending_verification'
   */
  async submitPaymentProof(
    tenantId: string,
    userId: string,
    input: PaymentProofInput
  ): Promise<PaymentProofRecord> {
    const proof = await this.repository.createPaymentProof(tenantId, userId, input);
    await this.repository.updateTenantSubscriptionStatus(tenantId, "pending_verification");
    return proof;
  }

  /**
   * Retrieves tenant billing status, countdown days, and payment proofs history
   */
  async getBillingStatus(tenantId: string): Promise<TenantBillingStatus> {
    const tenant = await this.repository.getTenantBilling(tenantId);
    if (!tenant) {
      throw new Error("TENANT_NOT_FOUND");
    }

    const proofs = await this.repository.getPaymentProofs(tenantId);
    const daysRemaining = calculateDaysRemaining(
      tenant.subscription_status,
      tenant.trial_ends_at,
      tenant.subscription_ends_at
    );

    return {
      subscription_status: tenant.subscription_status,
      trial_ends_at: tenant.trial_ends_at,
      subscription_ends_at: tenant.subscription_ends_at,
      days_remaining: daysRemaining,
      payment_proofs: proofs,
    };
  }

  /**
   * DEV-SL.4: Evaluates expiring subscriptions and dispatches renewal reminders idempotently
   */
  async evaluateAndDispatchReminders(): Promise<DispatchRemindersSummary> {
    const now = new Date();
    const results: ReminderResult[] = [];
    let dispatchedCount = 0;
    let skippedCount = 0;

    try {
      const tenants = await this.repository.getActiveOrTrialTenants();

      for (const tenant of tenants) {
        const expiryDateStr = tenant.subscription_ends_at || tenant.trial_ends_at;
        if (!expiryDateStr) continue;

        const expiryDate = new Date(expiryDateStr);
        const diffMs = expiryDate.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = Math.ceil(diffHours / 24);

        let threshold: "5_days_before" | "expiry_day" | null = null;
        if (diffDays >= 4 && diffDays <= 5) {
          threshold = "5_days_before";
        } else if (diffHours <= 24 && diffHours >= -24) {
          threshold = "expiry_day";
        }

        if (!threshold) continue;

        const expiryDateBucket = expiryDateStr.split("T")[0];
        const idempotencyKey = `${tenant.id}:renewal_reminder:${threshold}:${expiryDateBucket}`;

        const alreadySent = await this.repository.isReminderDispatched(idempotencyKey);
        if (alreadySent) {
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

        const recipientPhone =
          (await this.repository.getTenantOwnerPhone(tenant.id)) || "01000000000";

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

        try {
          await this.repository.insertReminderLog({
            tenant_id: tenant.id,
            idempotency_key: idempotencyKey,
            recipient_phone: recipientPhone,
            message: formattedMessage,
          });

          dispatchedCount += 1;
          results.push({
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            threshold,
            idempotency_key: idempotencyKey,
            status: "dispatched",
          });
          logger.info(`[BillingService] Logged ${threshold} reminder for ${tenant.name}`);
        } catch (err: unknown) {
          results.push({
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            threshold,
            idempotency_key: idempotencyKey,
            status: "failed",
            error: (err as Error).message,
          });
        }
      }

      return {
        evaluated_tenants: tenants.length,
        reminders_dispatched: dispatchedCount,
        reminders_skipped_already_sent: skippedCount,
        results,
      };
    } catch (err: unknown) {
      logger.error("[BillingService] Error in reminder dispatcher", err);
      return {
        evaluated_tenants: 0,
        reminders_dispatched: 0,
        reminders_skipped_already_sent: 0,
        results: [],
      };
    }
  }
}
