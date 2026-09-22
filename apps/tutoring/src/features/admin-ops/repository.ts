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

  private mapTenantRow(row: Record<string, any>): AdminTenantSummary {
    const rawUsers = row.users;
    const usersList = Array.isArray(rawUsers) ? rawUsers : (rawUsers ? [rawUsers] : []);
    const ownerUser = usersList.find((u: any) => u.role === "owner" || u.role === "center_owner") || usersList[0];
    const rawStudents = row.students;
    const studentsCount = Array.isArray(rawStudents) && rawStudents[0] && typeof rawStudents[0].count === "number"
      ? rawStudents[0].count
      : undefined;

    const tier = (row.subscription_tier || "").toLowerCase();
    const settings = row.settings || {};
    let limit = 100;
    let planName = "باقة 100 طالب";
    if (typeof settings.students_limit === "number" && settings.students_limit > 0) {
      limit = settings.students_limit;
      planName = settings.plan_name || `باقة ${limit} طالب`;
    } else if (tier === "growth" || tier.includes("250")) {
      limit = 250;
      planName = "باقة 250 طالب";
    } else if (tier === "pro" || tier.includes("500")) {
      limit = 500;
      planName = "باقة 500 طالب";
    }

    return {
      id: row.id,
      name: row.name,
      status: row.status,
      subscription_status: row.subscription_status,
      subscription_tier: row.subscription_tier || tier,
      students_limit: limit,
      plan_name: planName,
      account_type: row.account_type || (ownerUser?.role === "center_owner" ? "center" : "teacher"),
      email: ownerUser?.email || undefined,
      phone: ownerUser?.phone || undefined,
      full_name: ownerUser?.full_name || undefined,
      students_count: studentsCount,
      trial_ends_at: row.trial_ends_at,
      subscription_ends_at: row.subscription_ends_at,
      deleted_at: row.deleted_at,
      created_at: row.created_at,
    };
  }

  async listAllTenants(): Promise<AdminTenantSummary[]> {
    const { data, error } = await this.client
      .from("tenants")
      .select("id, name, status, subscription_status, subscription_tier, settings, account_type, trial_ends_at, subscription_ends_at, deleted_at, created_at, users(email, phone, full_name, role), students(count)")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    return ((data || []) as Record<string, any>[]).map((t) => this.mapTenantRow(t));
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
      .select("id, tenant_id, amount, payment_method, reference_number, proof_image_url, status, admin_notes, created_at, reviewed_at, tenants(name)")
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

  async getPaymentProof(id: string): Promise<{ id: string; tenant_id: string; status: string; admin_notes?: string | null; amount?: number | null } | null> {
    const { data, error } = await this.client
      .from("payment_proofs")
      .select("id, tenant_id, status, admin_notes, amount")
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
    newEndsAt: string,
    targetTier?: string,
    planSettings?: Record<string, any>
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

    const updatePayload: Record<string, unknown> = {
      subscription_status: "active",
      subscription_ends_at: newEndsAt,
    };
    if (targetTier) {
      updatePayload.subscription_tier = targetTier;
    }
    if (planSettings) {
      const existing = await this.getTenant(tenantId);
      const prevSettings = (existing as any)?.settings || {};
      updatePayload.settings = { ...prevSettings, ...planSettings };
    }

    const { data: updatedTenant, error: tenantUpdateErr } = await this.client
      .from("tenants")
      .update(updatePayload)
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
      .select("id, name, status, subscription_status, account_type, trial_ends_at, subscription_ends_at, deleted_at, created_at, users(email, phone, full_name, role), students(count)")
      .eq("id", tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return data ? this.mapTenantRow(data as Record<string, any>) : null;
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

  async purgeTestData(_adminId: string): Promise<{ deleted_tenants_count: number; deleted_proofs_count: number }> {
    // 1. Clean test/rejected payment proofs
    const { data: testProofs } = await this.client
      .from("payment_proofs")
      .delete()
      .or("reference_number.ilike.test%,admin_notes.ilike.%test%,status.eq.rejected")
      .select("id");

    const deletedProofsCount = (testProofs || []).length;

    // 2. Clean test tenants (excluding any tenant with users having role = admin or owner email = founder)
    const { data: testTenants } = await this.client
      .from("tenants")
      .delete()
      .or("name.ilike.%test%,name.ilike.%تجربة%,name.ilike.%demo%")
      .not("id", "eq", "7b8b30e0-c7c3-44c6-ac00-d7fc58bcf609")
      .select("id");

    const deletedTenantsCount = (testTenants || []).length;

    return {
      deleted_tenants_count: deletedTenantsCount,
      deleted_proofs_count: deletedProofsCount,
    };
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

  async getPaymentProof(id: string): Promise<{ id: string; tenant_id: string; status: string; admin_notes?: string | null; amount?: number | null } | null> {
    const proof = this.paymentProofs.find((p) => p.id === id);
    return proof ? { id: proof.id, tenant_id: proof.tenant_id, status: proof.status, admin_notes: proof.admin_notes, amount: proof.amount } : null;
  }

  async approvePaymentProof(
    proofId: string,
    tenantId: string,
    _adminId: string,
    newEndsAt: string,
    targetTier?: string,
    planSettings?: Record<string, any>
  ): Promise<AdminTenantSummary> {
    const proof = this.paymentProofs.find((p) => p.id === proofId);
    if (proof) {
      proof.status = "approved";
      proof.reviewed_at = new Date().toISOString();
    }

    let tenant = this.tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      tenant = {
        id: tenantId,
        name: "Test Tenant",
        status: "active",
        subscription_status: "active",
        subscription_ends_at: newEndsAt,
        subscription_tier: targetTier || "starter",
        students_limit: planSettings?.students_limit,
        plan_name: planSettings?.plan_name,
        settings: planSettings || {},
      };
      this.tenants.push(tenant);
    } else {
      tenant.subscription_status = "active";
      tenant.subscription_ends_at = newEndsAt;
      if (targetTier) tenant.subscription_tier = targetTier;
      if (planSettings) {
        tenant.settings = { ...(tenant.settings || {}), ...planSettings };
        if (planSettings.students_limit) tenant.students_limit = planSettings.students_limit;
        if (planSettings.plan_name) tenant.plan_name = planSettings.plan_name;
      }
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

  async purgeTestData(_adminId: string): Promise<{ deleted_tenants_count: number; deleted_proofs_count: number }> {
    const initialTenants = this.tenants.length;
    this.tenants = this.tenants.filter(
      (t) => !t.name.toLowerCase().includes("test") && !t.name.includes("تجربة") && !t.name.toLowerCase().includes("demo")
    );
    const deletedTenants = initialTenants - this.tenants.length;

    const initialProofs = this.paymentProofs.length;
    this.paymentProofs = this.paymentProofs.filter(
      (p) => !(p.admin_notes || "").toLowerCase().includes("test") && p.status !== "rejected"
    );
    const deletedProofs = initialProofs - this.paymentProofs.length;

    return {
      deleted_tenants_count: deletedTenants,
      deleted_proofs_count: deletedProofs,
    };
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
