import { SupabaseClient } from "@supabase/supabase-js";
import {
  TenantPlatformSettings,
  SavePlatformSettingsDto,
  IPlatformBuilderRepository,
  TenantPlanDetails,
} from "./types.js";

/**
 * Supabase-backed implementation of IPlatformBuilderRepository
 */
export class SupabasePlatformBuilderRepository implements IPlatformBuilderRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly privilegedClient?: SupabaseClient
  ) {}

  private get queryClient(): SupabaseClient {
    return this.privilegedClient || this.client;
  }

  async getByTenantId(tenantId: string): Promise<TenantPlatformSettings | null> {
    const { data, error } = await this.queryClient
      .from("tenant_platform_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return (data as TenantPlatformSettings) || null;
  }

  async getBySubdomain(subdomain: string): Promise<TenantPlatformSettings | null> {
    const clean = subdomain.trim().toLowerCase();
    const { data, error } = await this.queryClient
      .from("tenant_platform_settings")
      .select("*")
      .ilike("subdomain", clean)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return (data as TenantPlatformSettings) || null;
  }

  async isSubdomainTaken(subdomain: string, excludeTenantId?: string): Promise<boolean> {
    const clean = subdomain.trim().toLowerCase();
    let query = this.queryClient
      .from("tenant_platform_settings")
      .select("id, tenant_id")
      .ilike("subdomain", clean);

    if (excludeTenantId) {
      query = query.neq("tenant_id", excludeTenantId);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return Boolean(data && data.length > 0);
  }

  async upsert(tenantId: string, settings: SavePlatformSettingsDto): Promise<TenantPlatformSettings> {
    const record = {
      tenant_id: tenantId,
      subdomain: settings.subdomain.trim().toLowerCase(),
      display_title: settings.display_title.trim(),
      subject_title: settings.subject_title.trim(),
      headline_text: settings.headline_text || null,
      subtitle_text: settings.subtitle_text || null,
      cutout_avatar_url: settings.cutout_avatar_url || null,
      theme_preset: settings.theme_preset || "navy",
      custom_primary_color: settings.custom_primary_color || null,
      is_active: settings.is_active !== false,
      allow_public_signup: settings.allow_public_signup !== false,
      require_approval: Boolean(settings.require_approval),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.queryClient
      .from("tenant_platform_settings")
      .upsert(record, { onConflict: "tenant_id" })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as TenantPlatformSettings;
  }

  async getTenantPlan(tenantId: string): Promise<TenantPlanDetails> {
    const { data, error } = await this.queryClient
      .from("tenants")
      .select("subscription_tier, subscription_status, settings")
      .eq("id", tenantId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    const tier = (data?.subscription_tier || "").toLowerCase();
    const status = (data?.subscription_status || "").toLowerCase();
    const settings = data?.settings || {};

    const isExplicitPro =
      tier === "pro" ||
      tier === "growth" ||
      tier.includes("pro") ||
      tier.includes("750") ||
      tier.includes("1500") ||
      Boolean(settings?.is_pro) ||
      Boolean(settings?.plan_name?.toLowerCase().includes("pro"));

    const isActive = status === "active" || status === "trialing" || status === "paid";

    return {
      subscription_tier: tier,
      subscription_status: status,
      is_pro: isExplicitPro,
      is_active: isActive,
    };
  }
}

/**
 * In-memory Fake implementation of IPlatformBuilderRepository for ultra-fast unit testing
 */
export class FakePlatformBuilderRepository implements IPlatformBuilderRepository {
  private records: Map<string, TenantPlatformSettings> = new Map();
  private tenantPlans: Map<string, TenantPlanDetails> = new Map();

  setTenantPlan(tenantId: string, plan: TenantPlanDetails): void {
    this.tenantPlans.set(tenantId, plan);
  }

  async getByTenantId(tenantId: string): Promise<TenantPlatformSettings | null> {
    return this.records.get(tenantId) || null;
  }

  async getBySubdomain(subdomain: string): Promise<TenantPlatformSettings | null> {
    const clean = subdomain.trim().toLowerCase();
    for (const item of this.records.values()) {
      if (item.subdomain.toLowerCase() === clean) {
        return item;
      }
    }
    return null;
  }

  async isSubdomainTaken(subdomain: string, excludeTenantId?: string): Promise<boolean> {
    const clean = subdomain.trim().toLowerCase();
    for (const item of this.records.values()) {
      if (item.subdomain.toLowerCase() === clean && item.tenant_id !== excludeTenantId) {
        return true;
      }
    }
    return false;
  }

  async upsert(tenantId: string, settings: SavePlatformSettingsDto): Promise<TenantPlatformSettings> {
    const existing = this.records.get(tenantId);
    const saved: TenantPlatformSettings = {
      id: existing?.id || `fake-plat-${Date.now()}`,
      tenant_id: tenantId,
      subdomain: settings.subdomain.trim().toLowerCase(),
      display_title: settings.display_title.trim(),
      subject_title: settings.subject_title.trim(),
      headline_text: settings.headline_text || null,
      subtitle_text: settings.subtitle_text || null,
      cutout_avatar_url: settings.cutout_avatar_url || null,
      theme_preset: settings.theme_preset || "navy",
      custom_primary_color: settings.custom_primary_color || null,
      is_active: settings.is_active !== false,
      allow_public_signup: settings.allow_public_signup !== false,
      require_approval: Boolean(settings.require_approval),
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.records.set(tenantId, saved);
    return saved;
  }

  async getTenantPlan(tenantId: string): Promise<TenantPlanDetails> {
    return (
      this.tenantPlans.get(tenantId) || {
        subscription_tier: "starter",
        subscription_status: "active",
        is_pro: false,
        is_active: true,
      }
    );
  }
}
