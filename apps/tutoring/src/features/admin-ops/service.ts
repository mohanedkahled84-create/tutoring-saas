import {
  AdminTenantSummary,
  AdminOverviewMetrics,
  PaymentProofAdminItem,
  ApprovePaymentProofResult,
  TenantSubscriptionOverrideDTO,
  NewSignupAlertPayload,
  IAdminOpsRepository,
} from "./types.js";
import { formatNewSignupMessage } from "./founderAlert.js";

export class AdminOpsService {
  constructor(private readonly repo: IAdminOpsRepository) {}

  async listTenants(): Promise<AdminTenantSummary[]> {
    return this.repo.listAllTenants();
  }

  async getOverview(): Promise<AdminOverviewMetrics> {
    return this.repo.getOverviewCounts();
  }

  async listPaymentProofs(status?: string): Promise<PaymentProofAdminItem[]> {
    return this.repo.listPaymentProofs(status);
  }

  async approvePaymentProof(
    proofId: string,
    adminId: string,
    extendDays: number = 30
  ): Promise<ApprovePaymentProofResult> {
    const proof = await this.repo.getPaymentProof(proofId);
    if (!proof) {
      throw new Error("PROOF_NOT_FOUND");
    }

    const tenant = await this.repo.getTenant(proof.tenant_id);
    const now = new Date();
    let currentEnds = tenant?.subscription_ends_at ? new Date(tenant.subscription_ends_at) : now;
    if (currentEnds < now) {
      currentEnds = now;
    }
    const days = extendDays > 0 ? extendDays : 30;
    const newEnds = new Date(currentEnds.getTime() + days * 24 * 60 * 60 * 1000);

    // Detect target tier and student capacity from proof notes or amount
    const notes = proof.admin_notes || "";
    const amt = Number(proof.amount || 0);
    let targetTier = tenant?.subscription_tier || "starter";
    let targetLimit = 300;
    let targetPlanName = "باقة 300 طالب";

    if (notes.includes("750") || amt === 799 || amt === 7670) {
      targetTier = "growth";
      targetLimit = 750;
      targetPlanName = "باقة 750 طالب";
    } else if (notes.includes("1500") || amt === 1299 || amt === 12470) {
      targetTier = "pro";
      targetLimit = 1500;
      targetPlanName = "باقة 1500 طالب";
    } else if (notes.includes("300") || amt === 399 || amt === 3830) {
      targetTier = "starter";
      targetLimit = 300;
      targetPlanName = "باقة 300 طالب";
    } else if (notes.includes("250") || amt === 899 || amt === 9709) {
      targetTier = "growth";
      targetLimit = 250;
      targetPlanName = "باقة 250 طالب";
    } else if (notes.includes("500") || amt === 1499 || amt === 16189) {
      targetTier = "pro";
      targetLimit = 500;
      targetPlanName = "باقة 500 طالب";
    } else if (notes.includes("100") || amt === 599 || amt === 6469) {
      targetTier = "starter";
      targetLimit = 100;
      targetPlanName = "باقة 100 طالب";
    }

    const updatedTenant = await this.repo.approvePaymentProof(
      proofId,
      proof.tenant_id,
      adminId,
      newEnds.toISOString(),
      targetTier,
      { students_limit: targetLimit, plan_name: targetPlanName, plan_id: `plan_${targetLimit}` }
    );

    return {
      message: `Payment proof approved successfully. Tenant subscription activated for ${days} days on ${targetPlanName}.`,
      subscription_ends_at: newEnds.toISOString(),
      tenant: updatedTenant,
    };
  }

  async rejectPaymentProof(
    proofId: string,
    adminId: string,
    reason?: string
  ): Promise<{ message: string }> {
    const proof = await this.repo.getPaymentProof(proofId);
    if (!proof) {
      throw new Error("PROOF_NOT_FOUND");
    }

    await this.repo.rejectPaymentProof(
      proofId,
      proof.tenant_id,
      adminId,
      reason || "Payment verification failed"
    );

    return { message: "Payment proof rejected and tenant marked past_due." };
  }

  async updateSubscription(
    tenantId: string,
    dto: TenantSubscriptionOverrideDTO
  ): Promise<AdminTenantSummary> {
    const updatePayload: Record<string, unknown> = {};
    if (dto.status) updatePayload.subscription_status = dto.status;
    if (dto.soft_delete) updatePayload.deleted_at = new Date().toISOString();
    if (dto.soft_delete === false) updatePayload.deleted_at = null;

    const requestedTier = dto.tier || dto.subscription_tier || dto.plan;
    if (requestedTier) {
      const lower = requestedTier.toLowerCase();
      let limit = 300;
      let name = "باقة 300 طالب";
      let tier = "starter";
      if (lower.includes("750") || lower === "growth") {
        limit = 750;
        name = "باقة 750 طالب";
        tier = "growth";
      } else if (lower.includes("1500") || lower === "pro") {
        limit = 1500;
        name = "باقة 1500 طالب";
        tier = "pro";
      } else if (lower.includes("300") || lower === "starter") {
        limit = 300;
        name = "باقة 300 طالب";
        tier = "starter";
      } else if (lower.includes("250")) {
        limit = 250;
        name = "باقة 250 طالب";
        tier = "growth";
      } else if (lower.includes("500")) {
        limit = 500;
        name = "باقة 500 طالب";
        tier = "pro";
      } else if (lower.includes("100")) {
        limit = 100;
        name = "باقة 100 طالب";
        tier = "starter";
      }
      updatePayload.subscription_tier = tier;
      const tenant = await this.repo.getTenant(tenantId);
      const existingSettings = (tenant as any)?.settings || {};
      updatePayload.settings = {
        ...existingSettings,
        students_limit: limit,
        plan_name: name,
        plan_id: `plan_${limit}`,
      };
    }

    if (dto.extend_days && typeof dto.extend_days === "number") {
      const tenant = await this.repo.getTenant(tenantId);
      const current = tenant?.subscription_ends_at ? new Date(tenant.subscription_ends_at) : new Date();
      const base = current < new Date() ? new Date() : current;
      updatePayload.subscription_ends_at = new Date(
        base.getTime() + dto.extend_days * 24 * 60 * 60 * 1000
      ).toISOString();
      updatePayload.subscription_status = "active";
    }

    return this.repo.updateTenantSubscription(tenantId, updatePayload);
  }

  async alertFounder(payload: NewSignupAlertPayload): Promise<void> {
    const formatted = formatNewSignupMessage(payload);
    await this.repo.logFounderAlert(payload, formatted);
  }
}
