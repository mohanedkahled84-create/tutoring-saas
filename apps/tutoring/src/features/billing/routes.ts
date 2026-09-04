import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { validateBody } from "../../shared/middleware/validation.js";
import { getServices } from "../../composition.js";
import { BillingService } from "./service.js";

export const billingRouter = Router();

const paymentProofSchema = z.object({
  amount: z.number().positive("Amount must be a positive number"),
  payment_method: z.enum(["instapay", "vodafone_cash", "bank_transfer", "cash", "other"]),
  reference_number: z.string().max(100).optional().nullable(),
  proof_image_url: z.string().url("Invalid image URL").optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

function resolveBillingService(req: AuthenticatedRequest): BillingService {
  const services = getServices(req);
  return services.billing as BillingService;
}

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
