export type PaymentMethod =
  | "instapay"
  | "vodafone_cash"
  | "bank_transfer"
  | "cash"
  | "other";

export interface PaymentProofInput {
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string | null;
  proof_image_url?: string | null;
  notes?: string | null;
}

export interface PaymentProofRecord {
  id: string;
  tenant_id: string;
  submitted_by?: string;
  amount: number;
  payment_method: string;
  reference_number?: string | null;
  proof_image_url?: string | null;
  admin_notes?: string | null;
  status: string;
  created_at?: string;
  reviewed_at?: string | null;
}

export interface TenantBillingInfo {
  id: string;
  name: string;
  subscription_status: string;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
}

export interface TenantBillingStatus {
  subscription_status: string;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  days_remaining: number;
  payment_proofs: PaymentProofRecord[];
}

export interface ReminderResult {
  tenant_id: string;
  tenant_name: string;
  threshold: "5_days_before" | "expiry_day";
  idempotency_key: string;
  status: "dispatched" | "already_sent" | "failed";
  error?: string;
}

export interface DispatchRemindersSummary {
  evaluated_tenants: number;
  reminders_dispatched: number;
  reminders_skipped_already_sent: number;
  results: ReminderResult[];
}

export interface IBillingRepository {
  createPaymentProof(
    tenantId: string,
    userId: string,
    input: PaymentProofInput
  ): Promise<PaymentProofRecord>;
  updateTenantSubscriptionStatus(tenantId: string, status: string): Promise<void>;
  getTenantBilling(tenantId: string): Promise<TenantBillingInfo | null>;
  getPaymentProofs(tenantId: string): Promise<PaymentProofRecord[]>;
  getActiveOrTrialTenants(): Promise<TenantBillingInfo[]>;
  isReminderDispatched(idempotencyKey: string): Promise<boolean>;
  getTenantOwnerPhone(tenantId: string): Promise<string | null>;
  insertReminderLog(entry: {
    tenant_id: string;
    idempotency_key: string;
    recipient_phone: string;
    message: string;
  }): Promise<void>;
}
