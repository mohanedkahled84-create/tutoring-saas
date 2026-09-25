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

// DEV-SL.3: POST /api/admin/payment-proofs/:id/approve - Approve payment & extend subscription by specified days (default 30)
adminRouter.post(
  "/payment-proofs/:id/approve",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id: proofId } = req.params;
    const { extend_days } = req.body || {};

    try {
      const adminOpsService = getServices(req).adminOps;
      const result = await adminOpsService.approvePaymentProof(
        proofId,
        adminId,
        extend_days ? Number(extend_days) : 30
      );
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
    const { status, extend_days, soft_delete, tier, subscription_tier, plan } = req.body;

    try {
      const adminOpsService = getServices(req).adminOps;
      const tenant = await adminOpsService.updateSubscription(tenantId, {
        status,
        extend_days,
        soft_delete,
        tier: tier || subscription_tier || plan,
      });
      res.json({ message: "Tenant subscription updated successfully", tenant });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update tenant subscription";
      res.status(400).json({ error: { code: "BAD_REQUEST", message } });
    }
  }
);

// Admin-level Gift Codes Management
adminRouter.get("/gift-codes", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const billingService = getServices(req).billing;
    const codes = await billingService.listGiftCodes();
    res.json({ gift_codes: codes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list gift codes";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

adminRouter.post("/gift-codes", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const billingService = getServices(req).billing;
    const code = await billingService.createGiftCode(req.body);
    res.status(201).json({ message: "Gift code created successfully", gift_code: code });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create gift code";
    res.status(400).json({ error: { code: "BAD_REQUEST", message } });
  }
});

adminRouter.patch("/gift-codes/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const billingService = getServices(req).billing;
    const code = await billingService.updateGiftCode(id, req.body);
    res.json({ message: "Gift code updated successfully", gift_code: code });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update gift code";
    res.status(400).json({ error: { code: "BAD_REQUEST", message } });
  }
});

adminRouter.delete("/gift-codes/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const billingService = getServices(req).billing;
    await billingService.deleteGiftCode(id);
    res.json({ message: "Gift code deleted successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete gift code";
    res.status(400).json({ error: { code: "BAD_REQUEST", message } });
  }
});

// POST /api/admin/test-webhook - Admin only: test automation alert webhook
adminRouter.post("/test-webhook", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const adminOpsService = getServices(req).adminOps;
    const result = await adminOpsService.testWebhookAlert(req.user!.id);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to test webhook";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// POST /api/admin/purge-test-data - Admin only: safely clean test accounts and test payment proofs
adminRouter.post("/purge-test-data", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const adminOpsService = getServices(req).adminOps;
    const result = await adminOpsService.purgeTestData(req.user!.id);
    res.json({ message: "تم تنظيف بيانات التجربة بنجاح", ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to purge test data";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// GET /api/admin/outreach - Admin only: outreach campaign metrics and leads
adminRouter.get("/outreach", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
    const BASE_ID = "appOpSvZI6AHA0DxY";
    const TABLE_ID = "tblSX7a2jlDUHOm5H";

    const allRecords: any[] = [];
    let offset: string | null = null;
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?pageSize=100`;

    do {
      const fetchUrl: string = offset ? `${url}&offset=${offset}` : url;
      const resp = await fetch(fetchUrl, {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
      });
      if (!resp.ok) break;
      const data: any = await resp.json();
      if (data.records) allRecords.push(...data.records);
      offset = data.offset || null;
    } while (offset && allRecords.length < 1000);

    const metrics = {
      total: allRecords.length,
      ready: 0,
      sent: 0,
      replied: 0,
      interested: 0,
      converted: 0,
      not_interested: 0
    };

    const leads = allRecords.map(r => {
      const f = r.fields || {};
      const status = f["حالة التواصل"] || "جاهز للإرسال";

      if (status === "جاهز للإرسال") metrics.ready++;
      else if (status === "تم الإرسال") metrics.sent++;
      else if (status === "تم الرد") metrics.replied++;
      else if (status === "عميل محتمل (مهتم)") metrics.interested++;
      else if (status === "أصبح عميل (مشترك)") metrics.converted++;
      else if (status === "غير مهتم") metrics.not_interested++;

      return {
        id: r.id,
        "الاسم": f["الاسم"] || "",
        "رقم الهاتف": f["رقم الهاتف"] || "",
        "الرقم الدولي (واتساب)": f["الرقم الدولي (واتساب)"] || "",
        "حالة التواصل": status,
        "القالب المرسل (A/B Test)": f["القالب المرسل (A/B Test)"] || "Template A",
        "ملاحظات المحادثة": f["ملاحظات المحادثة"] || ""
      };
    });

    res.json({ metrics, leads });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch outreach data";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});


