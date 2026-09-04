export interface BusinessMetricsOverview {
  total_tenants: number;
  active_tenants: number;
  trial_tenants: number;
  expired_tenants: number;
  total_students: number;
  total_sessions: number;
  mrr_egp: number;
  whatsapp: {
    total_sent: number;
    total_failed: number;
    estimated_cost_egp: number;
  };
}

export interface SubscriptionStatusBreakdown {
  active: number;
  trial: number;
  pending_verification: number;
  expired: number;
  grace_period: number;
}

export interface AtRiskTenantSignal {
  tenant_id: string;
  tenant_name: string;
  owner_email?: string;
  risk_factor: "inactive_7d" | "trial_expiring_soon" | "high_message_failures";
  details: string;
}

export interface RecentSignupItem {
  tenant_id: string;
  name: string;
  owner_email?: string;
  created_at: string;
  status: string;
}

export interface BusinessDashboardData {
  overview: BusinessMetricsOverview;
  subscription_breakdown: SubscriptionStatusBreakdown;
  at_risk_tenants: AtRiskTenantSignal[];
  recent_signups: RecentSignupItem[];
}

export interface IBusinessDashboardRepository {
  getBusinessDashboardData(): Promise<BusinessDashboardData>;
}
