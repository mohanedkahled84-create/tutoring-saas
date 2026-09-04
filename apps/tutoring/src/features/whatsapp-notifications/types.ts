// ============================================================================
// Anti-Ban & Hardening Interfaces (DEV-EAH.1 to DEV-EAH.4)
// ============================================================================

export interface JitterConfig {
  minDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_JITTER_CONFIG: JitterConfig = {
  minDelayMs: 4000,
  maxDelayMs: 9000,
};

export const WARMUP_SCHEDULE: Record<number, number> = {
  1: 20,
  2: 40,
  3: 80,
  4: 150,
  5: 300,
  6: 600,
};

export const MAX_DAILY_VOLUME = 1200;

export interface ConnectionWarmUpInfo {
  connected_at: string | Date;
  is_legacy_exempt?: boolean;
}

export interface WarmUpCheckResult {
  allowed: boolean;
  day_number: number;
  daily_limit: number;
  sent_today: number;
  remaining: number;
  is_warm: boolean;
  reason?: string;
}

export type CircuitState = "HEALTHY" | "DEGRADED" | "CIRCUIT_OPEN_PAUSED";

export interface HealthStateResult {
  circuit_state: CircuitState;
  can_send: boolean;
  paused_until?: string;
  error_count: number;
}

export interface BusinessProfileData {
  business_name?: string | null;
  profile_picture_url?: string | null;
  category?: string | null;
  description?: string | null;
}

export interface ProfileChecklistResult {
  is_compliant: boolean;
  score_percentage: number;
  checklist: {
    has_name: boolean;
    has_profile_picture: boolean;
    has_category: boolean;
    has_description: boolean;
  };
  missing_requirements: string[];
}

// ============================================================================
// Webhook & Template Contracts
// ============================================================================

export interface AttendanceWebhookPayload {
  tenant_id: string;
  event_type: "attendance_recorded";
  student_id: string;
  student_name: string | null;
  session_id: string;
  attended: boolean;
  comment: string | null;
  parent_phone: string;
  idempotency_key: string;
}

export interface MessageTemplate {
  id?: string;
  tenant_id: string;
  template_type: string;
  variants: unknown;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppConnectionStatus {
  status: string;
  phone_number: string;
  gateway: string;
  latency_ms: number;
  daily_quota: {
    used: number;
    limit: number;
    safety_score: string;
  };
}

export interface IWhatsAppNotificationsRepository {
  isMessageDispatched(idempotencyKey: string): Promise<boolean>;
  getTemplates(tenantId?: string): Promise<MessageTemplate[]>;
  upsertTemplate(template: {
    tenant_id: string;
    template_type: string;
    variants: unknown;
    is_active: boolean;
  }): Promise<MessageTemplate>;
  getConnectionStatus(tenantId?: string): Promise<WhatsAppConnectionStatus>;
}
