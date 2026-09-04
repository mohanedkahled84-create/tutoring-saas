export interface AdminTenantSummary {
  id: string;
  name: string;
  status: string;
  subscription_status: string;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  deleted_at?: string | null;
  created_at?: string;
}

export interface AdminOverviewMetrics {
  total_tenants: number;
  total_students: number;
  total_sessions: number;
}

export interface PaymentProofAdminItem {
  id: string;
  tenant_id: string;
  amount: number;
  payment_method: string;
  reference_number?: string | null;
  proof_image_url?: string | null;
  status: string;
  admin_notes?: string | null;
  created_at: string;
  tenants?: { name: string } | null;
}

export interface ApprovePaymentProofResult {
  message: string;
  subscription_ends_at: string;
  tenant: AdminTenantSummary;
}

export interface TenantSubscriptionOverrideDTO {
  status?: string;
  extend_days?: number;
  soft_delete?: boolean;
}

export interface NewSignupAlertPayload {
  teacher_name: string;
  teacher_email: string;
  teacher_phone?: string;
  tenant_name: string;
  subject?: string;
  governorate?: string;
  trial_ends_at?: string;
}

export type ErrorSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface CriticalErrorAlertPayload {
  severity?: ErrorSeverity;
  error_name: string;
  error_message: string;
  stack?: string;
  context?: {
    method?: string;
    path?: string;
    request_id?: string;
    tenant_id?: string;
    user_id?: string;
    ip?: string;
    details?: unknown;
  };
  occurred_at?: string;
}

export interface CriticalErrorAlertResult {
  dispatched: boolean;
  suppressed: boolean;
  reason?: string;
  fingerprint: string;
  recipient_email: string;
  subject: string;
  suppressed_count?: number;
}

export interface IAdminOpsRepository {
  listAllTenants(): Promise<AdminTenantSummary[]>;
  getOverviewCounts(): Promise<AdminOverviewMetrics>;
  listPaymentProofs(status?: string): Promise<PaymentProofAdminItem[]>;
  getPaymentProof(id: string): Promise<{ id: string; tenant_id: string; status: string } | null>;
  approvePaymentProof(
    proofId: string,
    tenantId: string,
    adminId: string,
    newEndsAt: string
  ): Promise<AdminTenantSummary>;
  rejectPaymentProof(
    proofId: string,
    tenantId: string,
    adminId: string,
    reason: string
  ): Promise<void>;
  getTenant(tenantId: string): Promise<AdminTenantSummary | null>;
  updateTenantSubscription(
    tenantId: string,
    updates: Record<string, unknown>
  ): Promise<AdminTenantSummary>;
  logFounderAlert(payload: NewSignupAlertPayload, formattedMessage: string): Promise<void>;
}
