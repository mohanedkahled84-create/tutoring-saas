import { SupabaseClient } from "@supabase/supabase-js";
import {
  IBillingRepository,
  PaymentProofInput,
  PaymentProofRecord,
  TenantBillingInfo,
} from "./types.js";

export class SupabaseBillingRepository implements IBillingRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createPaymentProof(
    tenantId: string,
    userId: string,
    input: PaymentProofInput
  ): Promise<PaymentProofRecord> {
    const { data, error } = await this.supabase
      .from("payment_proofs")
      .insert({
        tenant_id: tenantId,
        submitted_by: userId,
        amount: input.amount,
        payment_method: input.payment_method,
        reference_number: input.reference_number || null,
        proof_image_url: input.proof_image_url || null,
        admin_notes: input.notes || null,
        status: "pending",
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to record payment proof");
    }

    return data as PaymentProofRecord;
  }

  async updateTenantSubscriptionStatus(tenantId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from("tenants")
      .update({ subscription_status: status })
      .eq("id", tenantId);

    if (error) {
      throw new Error(`Failed to update tenant status: ${error.message}`);
    }
  }

  async getTenantBilling(tenantId: string): Promise<TenantBillingInfo | null> {
    const { data, error } = await this.supabase
      .from("tenants")
      .select("id, name, subscription_status, trial_ends_at, subscription_ends_at")
      .eq("id", tenantId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as TenantBillingInfo;
  }

  async getPaymentProofs(tenantId: string): Promise<PaymentProofRecord[]> {
    const { data, error } = await this.supabase
      .from("payment_proofs")
      .select("id, tenant_id, amount, payment_method, reference_number, proof_image_url, status, created_at, reviewed_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data as PaymentProofRecord[];
  }

  async getActiveOrTrialTenants(): Promise<TenantBillingInfo[]> {
    const { data, error } = await this.supabase
      .from("tenants")
      .select("id, name, subscription_status, trial_ends_at, subscription_ends_at")
      .in("subscription_status", ["active", "trial", "past_due"])
      .is("deleted_at", null);

    if (error || !data) {
      return [];
    }

    return data as TenantBillingInfo[];
  }

  async isReminderDispatched(idempotencyKey: string): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from("message_logs")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      return Boolean(data);
    } catch {
      return false;
    }
  }

  async getTenantOwnerPhone(tenantId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from("users")
      .select("phone")
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .maybeSingle();

    return data?.phone || null;
  }

  async insertReminderLog(entry: {
    tenant_id: string;
    idempotency_key: string;
    recipient_phone: string;
    message: string;
  }): Promise<void> {
    const { error } = await this.supabase.from("message_logs").insert({
      tenant_id: entry.tenant_id,
      idempotency_key: entry.idempotency_key,
      message_type: "renewal_reminder",
      recipient_type: "owner",
      recipient_phone: entry.recipient_phone,
      status: "needs_review",
      error_detail: entry.message,
    });

    if (error) {
      throw new Error(`Failed to log reminder: ${error.message}`);
    }
  }
}
