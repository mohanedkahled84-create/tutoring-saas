import { SupabaseClient } from "@supabase/supabase-js";
import {
  BusinessDashboardData,
  IBusinessDashboardRepository,
} from "./types.js";

export class SupabaseBusinessDashboardRepository implements IBusinessDashboardRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getBusinessDashboardData(): Promise<BusinessDashboardData> {
    // 1. Fetch all tenants
    const { data: tenants } = await this.client
      .from("tenants")
      .select("id, name, status, subscription_status, trial_ends_at, subscription_ends_at, created_at")
      .order("created_at", { ascending: false });

    const tenantList = tenants || [];

    // 2. Fetch counts
    const [{ count: studentCount }, { count: sessionCount }, { data: messageStats }] = await Promise.all([
      this.client.from("students").select("*", { count: "exact", head: true }),
      this.client.from("sessions").select("*", { count: "exact", head: true }),
      this.client.from("message_logs").select("status"),
    ]);

    const activeTenants = tenantList.filter((t) => t.status === "active" || t.subscription_status === "active").length;
    const trialTenants = tenantList.filter((t) => t.subscription_status === "trial").length;
    const expiredTenants = tenantList.filter((t) => t.subscription_status === "expired").length;

    // Subscription breakdown
    const subscriptionBreakdown = {
      active: activeTenants,
      trial: trialTenants,
      pending_verification: tenantList.filter((t) => t.subscription_status === "pending_verification").length,
      expired: expiredTenants,
      grace_period: tenantList.filter((t) => t.subscription_status === "grace_period").length,
    };

    // WhatsApp volume & cost
    const allMsgs = messageStats || [];
    const sentCount = allMsgs.filter((m) => m.status === "sent" || m.status === "delivered").length;
    const failedCount = allMsgs.filter((m) => m.status === "failed").length;
    const estimatedCost = Math.round(sentCount * 0.05 * 100) / 100; // ~0.05 EGP per message

    // MRR: Estimated 300 EGP per active paid tenant
    const mrrEgp = activeTenants * 300;

    // At-Risk churn signals
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const atRiskTenants = tenantList
      .filter((t) => {
        if (t.subscription_status === "trial" && t.trial_ends_at) {
          const timeLeft = new Date(t.trial_ends_at).getTime() - now;
          return timeLeft > 0 && timeLeft < threeDaysMs;
        }
        return false;
      })
      .slice(0, 10)
      .map((t) => ({
        tenant_id: t.id,
        tenant_name: t.name,
        risk_factor: "trial_expiring_soon" as const,
        details: `تنتهي التجربة المجانية خلال أقل من 3 أيام (${new Date(t.trial_ends_at!).toLocaleDateString("ar-EG")})`,
      }));

    const recentSignups = tenantList.slice(0, 8).map((t) => ({
      tenant_id: t.id,
      name: t.name,
      created_at: t.created_at,
      status: t.subscription_status || t.status,
    }));

    return {
      overview: {
        total_tenants: tenantList.length,
        active_tenants: activeTenants,
        trial_tenants: trialTenants,
        expired_tenants: expiredTenants,
        total_students: studentCount || 0,
        total_sessions: sessionCount || 0,
        mrr_egp: mrrEgp,
        whatsapp: {
          total_sent: sentCount,
          total_failed: failedCount,
          estimated_cost_egp: estimatedCost,
        },
      },
      subscription_breakdown: subscriptionBreakdown,
      at_risk_tenants: atRiskTenants,
      recent_signups: recentSignups,
    };
  }
}

export class FakeBusinessDashboardRepository implements IBusinessDashboardRepository {
  public mockData: BusinessDashboardData;

  constructor(customData?: Partial<BusinessDashboardData>) {
    this.mockData = {
      overview: {
        total_tenants: 25,
        active_tenants: 15,
        trial_tenants: 8,
        expired_tenants: 2,
        total_students: 450,
        total_sessions: 120,
        mrr_egp: 4500,
        whatsapp: {
          total_sent: 3400,
          total_failed: 28,
          estimated_cost_egp: 170.0,
        },
      },
      subscription_breakdown: {
        active: 15,
        trial: 8,
        pending_verification: 1,
        expired: 2,
        grace_period: 0,
      },
      at_risk_tenants: [
        {
          tenant_id: "t-risk-1",
          tenant_name: "مستر إبراهيم - رياضيات",
          risk_factor: "trial_expiring_soon",
          details: "تنتهي التجربة خلال 48 ساعة ولم يتم رفع إثبات دفع",
        },
      ],
      recent_signups: [
        {
          tenant_id: "t-new-1",
          name: "أكاديمية المستقبل",
          created_at: new Date().toISOString(),
          status: "trial",
        },
      ],
      ...customData,
    };
  }

  async getBusinessDashboardData(): Promise<BusinessDashboardData> {
    return { ...this.mockData };
  }
}
