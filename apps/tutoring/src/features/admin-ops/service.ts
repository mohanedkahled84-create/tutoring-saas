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
    adminId: string
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
    const newEnds = new Date(currentEnds.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updatedTenant = await this.repo.approvePaymentProof(
      proofId,
      proof.tenant_id,
      adminId,
      newEnds.toISOString()
    );

    return {
      message: "Payment proof approved successfully. Tenant subscription activated for 30 days.",
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
