import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { requireAdmin } from "../middleware/auth.js";
import { getServiceSupabaseClient } from "../supabase.js";

export const adminRouter = Router();

// Apply requireAdmin to all routes in this router
adminRouter.use(requireAdmin);

// GET /api/admin/tenants - Admin only: view all tenants across system
adminRouter.get("/tenants", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = getServiceSupabaseClient();

  try {
    const { data: tenants, error } = await supabase
      .from("tenants")
      .select("id, name, status, subscription_status, trial_ends_at, subscription_ends_at, deleted_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({ tenants });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// GET /api/admin/overview - Admin only: platform metrics overview
adminRouter.get("/overview", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = getServiceSupabaseClient();

  try {
    const [{ count: tenantCount }, { count: studentCount }, { count: sessionCount }] = await Promise.all([
      supabase.from("tenants").select("*", { count: "exact", head: true }),
      supabase.from("students").select("*", { count: "exact", head: true }),
      supabase.from("sessions").select("*", { count: "exact", head: true }),
    ]);

    res.json({
      metrics: {
        total_tenants: tenantCount || 0,
        total_students: studentCount || 0,
        total_sessions: sessionCount || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// DEV-SL.3: GET /api/admin/payment-proofs - List pending/all payment proofs
adminRouter.get("/payment-proofs", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = getServiceSupabaseClient();
  const { status } = req.query;

  try {
    let query = supabase
      .from("payment_proofs")
      .select("id, tenant_id, amount, payment_method, reference_number, proof_image_url, status, admin_notes, created_at, tenants(name)")
      .order("created_at", { ascending: false });

    if (status && typeof status === "string") {
      query = query.eq("status", status);
    }

    const { data: proofs, error } = await query;
    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({ payment_proofs: proofs || [] });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// DEV-SL.3: POST /api/admin/payment-proofs/:id/approve - Approve payment & extend subscription by 30 days
adminRouter.post("/payment-proofs/:id/approve", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = getServiceSupabaseClient();
  const adminId = req.user!.id;
  const { id: proofId } = req.params;

  try {
    // 1. Fetch payment proof
    const { data: proof, error: proofErr } = await supabase
      .from("payment_proofs")
      .select("id, tenant_id, status")
      .eq("id", proofId)
      .single();

    if (proofErr || !proof) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Payment proof not found" } });
      return;
    }

    // 2. Fetch tenant current subscription ends
    const { data: tenant } = await supabase
      .from("tenants")
      .select("subscription_ends_at")
      .eq("id", proof.tenant_id)
      .single();

    const now = new Date();
    let currentEnds = tenant?.subscription_ends_at ? new Date(tenant.subscription_ends_at) : now;
    if (currentEnds < now) {
      currentEnds = now;
    }
    const newEnds = new Date(currentEnds.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 3. Mark approved
    await supabase
      .from("payment_proofs")
      .update({
        status: "approved",
        reviewed_by: adminId,
        reviewed_at: now.toISOString(),
      })
      .eq("id", proofId);

    // 4. Update tenant status to active and extend 30 days
    const { data: updatedTenant, error: tenantUpdateErr } = await supabase
      .from("tenants")
      .update({
        subscription_status: "active",
        subscription_ends_at: newEnds.toISOString(),
      })
      .eq("id", proof.tenant_id)
      .select()
      .single();

    if (tenantUpdateErr) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: tenantUpdateErr.message } });
      return;
    }

    res.json({
      message: "Payment proof approved successfully. Tenant subscription activated for 30 days.",
      subscription_ends_at: newEnds.toISOString(),
      tenant: updatedTenant,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// DEV-SL.3: POST /api/admin/payment-proofs/:id/reject - Reject payment proof
adminRouter.post("/payment-proofs/:id/reject", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = getServiceSupabaseClient();
  const adminId = req.user!.id;
  const { id: proofId } = req.params;
  const { reason } = req.body;

  try {
    const { data: proof, error: proofErr } = await supabase
      .from("payment_proofs")
      .select("id, tenant_id")
      .eq("id", proofId)
      .single();

    if (proofErr || !proof) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Payment proof not found" } });
      return;
    }

    await supabase
      .from("payment_proofs")
      .update({
        status: "rejected",
        admin_notes: reason || "Payment verification failed",
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", proofId);

    await supabase
      .from("tenants")
      .update({ subscription_status: "past_due" })
      .eq("id", proof.tenant_id);

    res.json({ message: "Payment proof rejected and tenant marked past_due." });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// DEV-SL.5: POST /api/admin/tenants/:id/subscription - Manual status override / soft deactivation
adminRouter.post("/tenants/:id/subscription", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = getServiceSupabaseClient();
  const { id: tenantId } = req.params;
  const { status, extend_days, soft_delete } = req.body;

  try {
    const updatePayload: Record<string, any> = {};
    if (status) updatePayload.subscription_status = status;
    if (soft_delete) updatePayload.deleted_at = new Date().toISOString();
    if (soft_delete === false) updatePayload.deleted_at = null;

    if (extend_days && typeof extend_days === "number") {
      const { data: t } = await supabase.from("tenants").select("subscription_ends_at").eq("id", tenantId).single();
      const current = t?.subscription_ends_at ? new Date(t.subscription_ends_at) : new Date();
      const base = current < new Date() ? new Date() : current;
      updatePayload.subscription_ends_at = new Date(base.getTime() + extend_days * 24 * 60 * 60 * 1000).toISOString();
      updatePayload.subscription_status = "active";
    }

    const { data: tenant, error } = await supabase
      .from("tenants")
      .update(updatePayload)
      .eq("id", tenantId)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({ message: "Tenant subscription updated successfully", tenant });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
