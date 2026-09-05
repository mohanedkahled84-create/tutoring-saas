import { SupabaseClient } from "@supabase/supabase-js";
import {
  AdminTenantSummary,
  AdminOverviewMetrics,
  PaymentProofAdminItem,
  NewSignupAlertPayload,
  IAdminOpsRepository,
} from "./types.js";
import { config } from "../../shared/config/index.js";
import { getServiceSupabaseClient } from "../../supabase.js";

export class SupabaseAdminOpsRepository implements IAdminOpsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAllTenants(): Promise<AdminTenantSummary[]> {
    const { data, error } = await this.client
      .from("tenants")
      .select("id, name, status, subscription_status, trial_ends_at, subscription_ends_at, deleted_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    return (data as AdminTenantSummary[]) || [];
  }

  async getOverviewCounts(): Promise<AdminOverviewMetrics> {
    const [{ count: tenantCount }, { count: studentCount }, { count: sessionCount }] =
      await Promise.all([
        this.client.from("tenants").select("*", { count: "exact", head: true }),
        this.client.from("students").select("*", { count: "exact", head: true }),
        this.client.from("sessions").select("*", { count: "exact", head: true }),
      ]);

    return {
      total_tenants: tenantCount || 0,
      total_students: studentCount || 0,
      total_sessions: sessionCount || 0,
    };
  }

  async listPaymentProofs(status?: string): Promise<PaymentProofAdminItem[]> {
    let query = this.client
      .from("payment_proofs")
      .select("id, tenant_id, amount, payment_method, reference_number, proof_image_url, status, admin_notes, created_at, tenants(name)")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return (data as unknown as PaymentProofAdminItem[]) || [];
  }

  async getPaymentProof(id: string): Promise<{ id: string; tenant_id: string; status: string } | null> {
    const { data, error } = await this.client
      .from("payment_proofs")
      .select("id, tenant_id, status")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return data || null;
  }

  async approvePaymentProof(
    proofId: string,
    tenantId: string,
    adminId: string,
    newEndsAt: string
  ): Promise<AdminTenantSummary> {
    const now = new Date().toISOString();

    await this.client
      .from("payment_proofs")
      .update({
        status: "approved",
        reviewed_by: adminId,
        reviewed_at: now,
      })
      .eq("id", proofId);

    const { data: updatedTenant, error: tenantUpdateErr } = await this.client
      .from("tenants")
      .update({
        subscription_status: "active",
        subscription_ends_at: newEndsAt,
      })
      .eq("id", tenantId)
      .select()
      .single();

    if (tenantUpdateErr) {
      throw new Error(tenantUpdateErr.message);
    }
    return updatedTenant as AdminTenantSummary;
  }

  async rejectPaymentProof(
    proofId: string,
    tenantId: string,
    adminId: string,
    reason: string
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.client
      .from("payment_proofs")
      .update({
        status: "rejected",
        admin_notes: reason || "Payment verification failed",
        reviewed_by: adminId,
        reviewed_at: now,
      })
      .eq("id", proofId);

    await this.client
      .from("tenants")
      .update({ subscription_status: "past_due" })
      .eq("id", tenantId);
  }

  async getTenant(tenantId: string): Promise<AdminTenantSummary | null> {
    const { data, error } = await this.client
      .from("tenants")
      .select("id, name, status, subscription_status, trial_ends_at, subscription_ends_at, deleted_at, created_at")
      .eq("id", tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return (data as AdminTenantSummary) || null;
  }

  async updateTenantSubscription(
    tenantId: string,
    updates: Record<string, unknown>
  ): Promise<AdminTenantSummary> {
    const { data, error } = await this.client
      .from("tenants")
      .update(updates)
      .eq("id", tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return data as AdminTenantSummary;
  }

  async logFounderAlert(payload: NewSignupAlertPayload, formattedMessage: string): Promise<void> {
    const idempotencyKey = `founder_alert:${payload.teacher_email}`;
    await this.client.from("message_logs").insert({
      tenant_id: null,
      idempotency_key: idempotencyKey,
      message_type: "founder_signup_alert",
      recipient_type: "system",
      recipient_phone: config.founderPhone,
      status: "needs_review",
      error_detail: formattedMessage,
    });
  }

  async logCriticalErrorAlert(data: {
    tenant_id?: string | null;
    idempotency_key: string;
    recipient_email: string;
    status: "sent" | "failed";
    error_detail: string;
  }): Promise<void> {
    const { error } = await this.client.from("message_logs").insert({
      tenant_id: data.tenant_id || null,
      idempotency_key: data.idempotency_key,
      message_type: "critical_error_email_alert",
      recipient_type: "system",
      recipient_phone: data.recipient_email,
      status: data.status,
      error_detail: data.error_detail,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
}

export class FakeAdminOpsRepository implements IAdminOpsRepository {
  public tenants: AdminTenantSummary[] = [];
  public studentsCount: number = 0;
  public sessionsCount: number = 0;
  public paymentProofs: PaymentProofAdminItem[] = [];
  public messageLogs: Array<Record<string, unknown>> = [];

  async listAllTenants(): Promise<AdminTenantSummary[]> {
    return [...this.tenants];
  }

  async getOverviewCounts(): Promise<AdminOverviewMetrics> {
    return {
      total_tenants: this.tenants.length,
      total_students: this.studentsCount,
      total_sessions: this.sessionsCount,
    };
  }

  async listPaymentProofs(status?: string): Promise<PaymentProofAdminItem[]> {
    if (status) {
      return this.paymentProofs.filter((p) => p.status === status);
    }
    return [...this.paymentProofs];
  }

  async getPaymentProof(id: string): Promise<{ id: string; tenant_id: string; status: string } | null> {
    const proof = this.paymentProofs.find((p) => p.id === id);
    return proof ? { id: proof.id, tenant_id: proof.tenant_id, status: proof.status } : null;
  }

  async approvePaymentProof(
    proofId: string,
    tenantId: string,
    _adminId: string,
    newEndsAt: string
  ): Promise<AdminTenantSummary> {
    const proof = this.paymentProofs.find((p) => p.id === proofId);
    if (proof) proof.status = "approved";

    let tenant = this.tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      tenant = {
        id: tenantId,
        name: "Test Tenant",
        status: "active",
        subscription_status: "active",
        subscription_ends_at: newEndsAt,
      };
      this.tenants.push(tenant);
    } else {
      tenant.subscription_status = "active";
      tenant.subscription_ends_at = newEndsAt;
    }
    return { ...tenant };
  }

  async rejectPaymentProof(
    proofId: string,
    tenantId: string,
    _adminId: string,
    reason: string
  ): Promise<void> {
    const proof = this.paymentProofs.find((p) => p.id === proofId);
    if (proof) {
      proof.status = "rejected";
      proof.admin_notes = reason;
    }
    const tenant = this.tenants.find((t) => t.id === tenantId);
    if (tenant) {
      tenant.subscription_status = "past_due";
    }
  }

  async getTenant(tenantId: string): Promise<AdminTenantSummary | null> {
    const tenant = this.tenants.find((t) => t.id === tenantId);
    return tenant ? { ...tenant } : null;
  }

  async updateTenantSubscription(
    tenantId: string,
    updates: Record<string, unknown>
  ): Promise<AdminTenantSummary> {
    const idx = this.tenants.findIndex((t) => t.id === tenantId);
    if (idx === -1) {
      const created: AdminTenantSummary = {
        id: tenantId,
        name: "Tenant",
        status: "active",
        subscription_status: (updates.subscription_status as string) || "active",
        ...updates,
      };
      this.tenants.push(created);
      return created;
    }
    this.tenants[idx] = { ...this.tenants[idx], ...updates };
    return { ...this.tenants[idx] };
  }

  async logFounderAlert(payload: NewSignupAlertPayload, formattedMessage: string): Promise<void> {
    this.messageLogs.push({ payload, formattedMessage });
  }

  async logCriticalErrorAlert(data: {
    tenant_id?: string | null;
    idempotency_key: string;
    recipient_email: string;
    status: "sent" | "failed";
    error_detail: string;
  }): Promise<void> {
    this.messageLogs.push({ ...data, message_type: "critical_error_email_alert" });
  }
}

let defaultAdminOpsRepo: IAdminOpsRepository | null = null;

export function getDefaultAdminOpsRepository(): IAdminOpsRepository {
  if (!defaultAdminOpsRepo) {
    if (process.env.NODE_ENV === "test") {
      defaultAdminOpsRepo = new FakeAdminOpsRepository();
    } else {
      defaultAdminOpsRepo = new SupabaseAdminOpsRepository(getServiceSupabaseClient());
    }
  }
  return defaultAdminOpsRepo;
}
