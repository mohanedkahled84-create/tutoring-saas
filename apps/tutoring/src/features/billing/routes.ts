import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { validateBody } from "../../shared/middleware/validation.js";
import { requireOwnerOrAdmin } from "../../shared/middleware/auth.js";
import { getServices } from "../../composition.js";
import { BillingService } from "./service.js";
import { dispatchAdminAlertWebhook } from "../admin-ops/index.js";


export const billingRouter = Router();

const createGiftCodeSchema = z.object({
  code: z.string().min(2, "رمز الكود يجب أن يتكون من حرفين على الأقل").max(50),
  discount_percent: z.number().min(1).max(100).optional().nullable(),
  discount_amount: z.number().positive().optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

const paymentProofSchema = z.object({
  amount: z.number().min(0, "Amount must be a non-negative number"),
  payment_method: z.enum(["instapay", "vodafone_cash", "bank_transfer", "cash", "coupon", "other"]),
  reference_number: z.string().max(100).optional().nullable(),
  proof_image_url: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  coupon_code: z.string().max(50).optional().nullable(),
});

const validateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").max(50),
  amount: z.number().positive("Amount must be a positive number"),
});

function resolveBillingService(req: AuthenticatedRequest): BillingService {
  const services = getServices(req);
  return services.billing as BillingService;
}

// POST /api/billing/validate-coupon
billingRouter.post(
  "/validate-coupon",
  validateBody(validateCouponSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const service = resolveBillingService(req);
      const result = await service.validateCoupon(req.body.code, req.body.amount);
      res.json(result);
    } catch (err: unknown) {
      res.status(400).json({
        error: { code: "INVALID_COUPON", message: (err as Error).message },
      });
    }
  }
);

// DEV-SL.3: POST /api/billing/payment-proof
billingRouter.post(
  "/payment-proof",
  validateBody(paymentProofSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveBillingService(req);
      const proof = await service.submitPaymentProof(tenantId, userId, req.body);

      dispatchAdminAlertWebhook({
        event_type: "payment_proof_submitted",
        teacher_name: req.user?.full_name || req.user?.name || req.user?.email || "معلم",
        tenant_name: req.user?.name || undefined,
        amount: Number(proof.amount),
        payment_method: proof.payment_method,
        reference_number: proof.reference_number || undefined,
        proof_image_url: proof.proof_image_url || undefined,
        admin_notes: proof.admin_notes || undefined,
        admin_dashboard_url: "https://centrly.app/admin",
        created_at: proof.created_at || new Date().toISOString(),
      }).catch(() => {});

      res.status(201).json({
        message:
          "Payment proof submitted successfully. Your account is pending verification by admin.",
        payment_proof: proof,
      });
    } catch (err: unknown) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: (err as Error).message },
      });
    }
  }
);

// GET /api/billing/status
billingRouter.get("/status", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;

  if (!tenantId) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const service = resolveBillingService(req);
    const status = await service.getBillingStatus(tenantId);
    res.json(status);
  } catch (err: unknown) {
    const errorMsg = (err as Error).message;
    if (errorMsg === "TENANT_NOT_FOUND") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Tenant not found" } });
      return;
    }
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch billing status", details: errorMsg },
    });
  }
});

// GET /api/billing/gift-codes - List all promo & gift codes
billingRouter.get(
  "/gift-codes",
  requireOwnerOrAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const service = resolveBillingService(req);
      const codes = await service.listGiftCodes();
      res.json({ gift_codes: codes });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to list gift codes";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// POST /api/billing/gift-codes - Create a new promo & gift code
billingRouter.post(
  "/gift-codes",
  requireOwnerOrAdmin,
  validateBody(createGiftCodeSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const service = resolveBillingService(req);
      const code = await service.createGiftCode(req.body);
      res.status(201).json({ message: "Gift code created successfully", gift_code: code });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create gift code";
      res.status(400).json({ error: { code: "BAD_REQUEST", message } });
    }
  }
);

// PATCH /api/billing/gift-codes/:id - Update or toggle status of a promo & gift code
billingRouter.patch(
  "/gift-codes/:id",
  requireOwnerOrAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const service = resolveBillingService(req);
      const code = await service.updateGiftCode(id, req.body);
      res.json({ message: "Gift code updated successfully", gift_code: code });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update gift code";
      res.status(400).json({ error: { code: "BAD_REQUEST", message } });
    }
  }
);

// DELETE /api/billing/gift-codes/:id - Delete a promo & gift code
billingRouter.delete(
  "/gift-codes/:id",
  requireOwnerOrAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const service = resolveBillingService(req);
      await service.deleteGiftCode(id);
      res.json({ message: "Gift code deleted successfully" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete gift code";
      res.status(400).json({ error: { code: "BAD_REQUEST", message } });
    }
  }
);

