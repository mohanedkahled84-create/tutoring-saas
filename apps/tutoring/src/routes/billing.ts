import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { z } from "zod";
import { validateBody } from "../middleware/validation.js";

export const billingRouter = Router();

const paymentProofSchema = z.object({
  amount: z.number().positive("Amount must be a positive number"),
  payment_method: z.enum(["instapay", "vodafone_cash", "bank_transfer", "cash", "other"]),
  reference_number: z.string().max(100).optional().nullable(),
  proof_image_url: z.string().url("Invalid image URL").optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// DEV-SL.3: POST /api/billing/payment-proof
// Allows tenant owner to submit screenshot/reference of InstaPay or Vodafone Cash transfer
billingRouter.post(
  "/payment-proof",
  validateBody(paymentProofSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const userId = req.user!.id;
    const { amount, payment_method, reference_number, proof_image_url, notes } = req.body;

    try {
      // 1. Record payment proof
      const { data: proof, error: proofErr } = await supabase
        .from("payment_proofs")
        .insert({
          tenant_id: tenantId,
          submitted_by: userId,
          amount,
          payment_method,
          reference_number: reference_number || null,
          proof_image_url: proof_image_url || null,
          admin_notes: notes || null,
          status: "pending",
        })
        .select()
        .single();

      if (proofErr) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: proofErr.message } });
        return;
      }

      // 2. Set tenant status to pending_verification
      await supabase
        .from("tenants")
        .update({ subscription_status: "pending_verification" })
        .eq("id", tenantId);

      res.status(201).json({
        message: "Payment proof submitted successfully. Your account is pending verification by admin.",
        payment_proof: proof,
      });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to submit payment proof" } });
    }
  }
);

// GET /api/billing/status - View current tenant subscription status & countdown
billingRouter.get("/status", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;

  try {
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id, name, subscription_status, trial_ends_at, subscription_ends_at")
      .eq("id", tenantId)
      .single();

    if (tenantErr || !tenant) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Tenant not found" } });
      return;
    }

    const { data: proofs } = await supabase
      .from("payment_proofs")
      .select("id, amount, payment_method, reference_number, status, created_at, reviewed_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    const now = new Date();
    let daysRemaining = 0;
    if (tenant.subscription_status === "trial" && tenant.trial_ends_at) {
      const ms = new Date(tenant.trial_ends_at).getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    } else if (tenant.subscription_ends_at) {
      const ms = new Date(tenant.subscription_ends_at).getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    }

    res.json({
      subscription_status: tenant.subscription_status,
      trial_ends_at: tenant.trial_ends_at,
      subscription_ends_at: tenant.subscription_ends_at,
      days_remaining: daysRemaining,
      payment_proofs: proofs || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch billing status" } });
  }
});
