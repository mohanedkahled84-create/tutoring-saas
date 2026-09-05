import { Router, Request, Response } from "express";
import { z } from "zod";
import { config } from "../../shared/config/index.js";
import { webhookIdempotency } from "../../shared/middleware/webhookIdempotency.js";
import { validateBody } from "../../shared/middleware/validation.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { logger } from "../../shared/utils/logger.js";

export const paymentWebhookRouter = Router();

const paymentWebhookSchema = z.object({
  event_id: z.string().min(1, "event_id is required"),
  tenant_id: z.string().uuid("tenant_id must be a valid UUID"),
  status: z.enum(["paid", "failed", "refunded"]),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("EGP"),
  plan: z.string().optional().default("growth"),
  reference: z.string().optional(),
});

/**
 * DEV-81 (GAP.3): Payment Webhook endpoint with HMAC signature verification & idempotency guard.
 * Prevents double-processing or replay attacks on financial state changes.
 */
paymentWebhookRouter.post(
  "/payment",
  webhookIdempotency({
    requireSignature: true,
    secret: () => process.env.PAYMENT_WEBHOOK_SECRET || config.internalApiSecret,
    keyExtractor: (req: Request) =>
      (req.headers["x-idempotency-key"] as string) || req.body?.event_id,
  }),
  validateBody(paymentWebhookSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { event_id, tenant_id, status, amount, plan } = req.body;
    const supabase = getServiceSupabaseClient();

    try {
      logger.info(`[PaymentWebhook] Processing webhook ${event_id} for tenant ${tenant_id}: ${status}`);

      if (status === "paid") {
        // Calculate new subscription end date (+30 days)
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);

        const { error: updateError } = await supabase
          .from("tenants")
          .update({
            subscription_status: "active",
            subscription_tier: plan,
            subscription_ends_at: newExpiry.toISOString(),
          })
          .eq("id", tenant_id);

        if (updateError && !updateError.message.includes("fetch failed")) {
          res.status(500).json({ error: { code: "DB_ERROR", message: updateError.message } });
          return;
        }

        res.status(200).json({
          success: true,
          event_id,
          tenant_id,
          status: "processed",
          new_expiry: newExpiry.toISOString(),
          amount,
        });
        return;
      }

      res.status(200).json({
        success: true,
        event_id,
        tenant_id,
        status: "ignored_non_success_event",
      });
    } catch (err: unknown) {
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: (err as Error).message },
      });
    }
  }
);
