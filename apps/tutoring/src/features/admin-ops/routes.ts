import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { requireAdmin } from "../../shared/middleware/auth.js";
import { getServices } from "../../composition.js";

export const adminRouter = Router();

// Apply requireAdmin to all routes in this router
adminRouter.use(requireAdmin);

// GET /api/admin/tenants - Admin only: view all tenants across system
adminRouter.get("/tenants", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const adminOpsService = getServices(req).adminOps;
    const tenants = await adminOpsService.listTenants();
    res.json({ tenants });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list tenants";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// GET /api/admin/overview - Admin only: platform metrics overview
adminRouter.get("/overview", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const adminOpsService = getServices(req).adminOps;
    const metrics = await adminOpsService.getOverview();
    res.json({ metrics });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get platform metrics";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// DEV-SL.3: GET /api/admin/payment-proofs - List pending/all payment proofs
adminRouter.get("/payment-proofs", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { status } = req.query;

  try {
    const adminOpsService = getServices(req).adminOps;
    const proofs = await adminOpsService.listPaymentProofs(
      typeof status === "string" ? status : undefined
    );
    res.json({ payment_proofs: proofs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list payment proofs";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// DEV-SL.3: POST /api/admin/payment-proofs/:id/approve - Approve payment & extend subscription by 30 days
adminRouter.post(
  "/payment-proofs/:id/approve",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id: proofId } = req.params;

    try {
      const adminOpsService = getServices(req).adminOps;
      const result = await adminOpsService.approvePaymentProof(proofId, adminId);
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "PROOF_NOT_FOUND") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Payment proof not found" } });
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to approve payment proof";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-SL.3: POST /api/admin/payment-proofs/:id/reject - Reject payment proof
adminRouter.post(
  "/payment-proofs/:id/reject",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id: proofId } = req.params;
    const { reason } = req.body;

    try {
      const adminOpsService = getServices(req).adminOps;
      const result = await adminOpsService.rejectPaymentProof(proofId, adminId, reason);
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "PROOF_NOT_FOUND") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Payment proof not found" } });
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to reject payment proof";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-SL.5: POST /api/admin/tenants/:id/subscription - Manual status override / soft deactivation
adminRouter.post(
  "/tenants/:id/subscription",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id: tenantId } = req.params;
    const { status, extend_days, soft_delete } = req.body;

    try {
      const adminOpsService = getServices(req).adminOps;
      const tenant = await adminOpsService.updateSubscription(tenantId, {
        status,
        extend_days,
        soft_delete,
      });
      res.json({ message: "Tenant subscription updated successfully", tenant });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update tenant subscription";
      res.status(400).json({ error: { code: "BAD_REQUEST", message } });
    }
  }
);
