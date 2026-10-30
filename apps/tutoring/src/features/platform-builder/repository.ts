import { SupabaseClient } from "@supabase/supabase-js";
import {
  TenantPlatformSettings,
  SavePlatformSettingsDto,
  IPlatformBuilderRepository,
  TenantPlanDetails,
  VideoViewLogDto,
  StudentVideoTrackingItem,
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

  async getPublicBySubdomain(subdomain: string): Promise<TenantPlatformSettings | null> {
    const clean = subdomain.trim().toLowerCase();
    const current = await this.getBySubdomain(clean);
    if (current) return current;

    // Settings created by the retired Vercel endpoint remain in whatsapp_inbox.
    // Read only the exact public subdomain key and only published settings so
    // existing teacher branding survives the API migration without exposing
    // other inbox rows.
    const { data: legacyRow, error: legacyError } = await this.queryClient
      .from("whatsapp_inbox")
      .select("message_body, status, updated_at")
      .eq("phone", `PLATFORM_SETTINGS_${clean}`)
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (legacyError && legacyError.code !== "PGRST116") throw legacyError;
    if (!legacyRow?.message_body) return null;

    let legacy: Record<string, unknown>;
    try {
      const parsed = typeof legacyRow.message_body === "string"
        ? JSON.parse(legacyRow.message_body)
        : legacyRow.message_body;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      legacy = parsed as Record<string, unknown>;
    } catch {
      return null;
    }

    if (
      String(legacy.subdomain || "").trim().toLowerCase() !== clean ||
      legacy.is_published === false ||
      legacy.is_active === false
    ) {
      return null;
    }

    return {
      id: `legacy-${clean}`,
      tenant_id: "",
      subdomain: clean,
      display_title: String(legacy.display_title || ""),
      subject_title: String(legacy.subject_title || ""),
      headline_text: typeof legacy.headline_text === "string" ? legacy.headline_text : null,
      subtitle_text: typeof legacy.subtitle_text === "string" ? legacy.subtitle_text : null,
      cutout_avatar_url: typeof legacy.cutout_avatar_url === "string" ? legacy.cutout_avatar_url : null,
      theme_preset: typeof legacy.theme_preset === "string" ? legacy.theme_preset : "navy",
      custom_primary_color: typeof legacy.custom_primary_color === "string" ? legacy.custom_primary_color : null,
      is_active: true,
      allow_public_signup: legacy.allow_public_signup !== false,
      require_approval: Boolean(legacy.require_approval),
      updated_at: legacyRow.updated_at || undefined,
    };
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

    if (data && data.length > 0) return true;
    const current = await this.getBySubdomain(clean);
    if (current) return current.tenant_id !== excludeTenantId;
    // A published legacy subdomain stays reserved until its verified owner is migrated.
    return Boolean(await this.getPublicBySubdomain(clean));
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

  async getPublicMaterials(tenantId: string): Promise<any[]> {
    const { data, error } = await this.queryClient
      .from("study_materials")
      .select("id, title, description, type, url, group_id, is_homework, due_date, book_name, pages, questions, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    let items = (data || []) as any[];

    try {
      const { data: quizzesData } = await this.queryClient
        .from("quizzes")
        .select("id, title, quiz_number, max_score, quiz_date, is_skipped, group_id, created_at")
        .eq("tenant_id", tenantId)
        .order("quiz_number", { ascending: false });
      if (quizzesData && quizzesData.length > 0) {
        const mappedQuizzes = quizzesData.map((q: any) => ({
          ...q,
          type: "quiz",
          is_quiz: true,
          title: q.title || `كويز ${q.quiz_number}`,
        }));
        items = [...items, ...mappedQuizzes];
      }
    } catch (_) {}

    return items;
  }

  async recordVideoView(tenantId: string, data: VideoViewLogDto): Promise<void> {
    const studentCode = (data.student_code || "").trim();
    const studentName = (data.student_name || "").trim() || "طالب";
    const progressPercent = Math.max(0, Math.min(100, Math.round(Number(data.progress_percent || 0))));
    const status = progressPercent >= 90 || data.status === "completed" ? "completed" : "watching";

    const properties = {
      student_code: studentCode,
      student_name: studentName,
      material_id: data.material_id || null,
      material_title: data.material_title || "فيديو حل واجب الباب الرابع",
      progress_percent: progressPercent,
      current_time: data.current_time || "01:45",
      duration_time: data.duration_time || "35:23",
      status,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.queryClient.from("telemetry_events").insert({
      tenant_id: tenantId,
      event_name: "video_view",
      session_id: studentCode || "anonymous",
      page_path: "/platform/public/video-view",
      properties,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Failed to insert video_view into telemetry_events:", error);
      throw error;
    }
  }

  async getVideoViews(tenantId: string): Promise<StudentVideoTrackingItem[]> {
    const { data, error } = await this.queryClient
      .from("telemetry_events")
      .select("id, tenant_id, event_name, properties, session_id, page_path, created_at")
      .eq("tenant_id", tenantId)
      .eq("event_name", "video_view")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("Failed to query telemetry_events video views:", error);
      return [];
    }

    const mapByCode = new Map<string, StudentVideoTrackingItem>();
    for (const row of (data || [])) {
      try {
        const p = (row.properties || {}) as Record<string, any>;
        const code = (p.student_code || row.session_id || "").trim();
        if (code && !mapByCode.has(code)) {
          mapByCode.set(code, {
            id: row.id,
            student_code: code,
            student_name: p.student_name || "طالب",
            material_title: p.material_title || "فيديو حل واجب الباب الرابع",
            progress_percent: Number(p.progress_percent || 0),
            current_time: p.current_time || "00:00",
            duration_time: p.duration_time || "35:23",
            status: p.status || "watching",
            updated_at: p.updated_at || row.created_at,
          });
        }
      } catch (_) {}
    }

    return Array.from(mapByCode.values());
  }

  async resetVideoView(tenantId: string, studentCode: string): Promise<void> {
    const { error } = await this.queryClient
      .from("telemetry_events")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("event_name", "video_view")
      .filter("properties->>student_code", "eq", studentCode);

    if (error) {
      throw new Error(`Failed to reset video view: ${error.message}`);
    }
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

  async getPublicBySubdomain(subdomain: string): Promise<TenantPlatformSettings | null> {
    return this.getBySubdomain(subdomain);
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

  private fakeMaterials: Map<string, any[]> = new Map();

  setFakeMaterials(tenantId: string, items: any[]): void {
    this.fakeMaterials.set(tenantId, items);
  }

  async getPublicMaterials(tenantId: string): Promise<any[]> {
    return this.fakeMaterials.get(tenantId) || [];
  }

  private fakeVideoViews: Map<string, StudentVideoTrackingItem[]> = new Map();

  async recordVideoView(tenantId: string, data: VideoViewLogDto): Promise<void> {
    const list = this.fakeVideoViews.get(tenantId) || [];
    const studentCode = (data.student_code || "").trim();
    const studentName = (data.student_name || "").trim() || "طالب";
    const progressPercent = Math.max(0, Math.min(100, Math.round(Number(data.progress_percent || 0))));
    const status = progressPercent >= 90 || data.status === "completed" ? "completed" : "watching";

    const item: StudentVideoTrackingItem = {
      id: "fake-" + Date.now(),
      student_code: studentCode,
      student_name: studentName,
      material_title: data.material_title || "فيديو حل واجب الباب الرابع",
      progress_percent: progressPercent,
      current_time: data.current_time || "01:45",
      duration_time: data.duration_time || "35:23",
      status,
      updated_at: new Date().toISOString(),
    };

    const filtered = list.filter((x) => x.student_code !== studentCode);
    this.fakeVideoViews.set(tenantId, [item, ...filtered]);
  }

  async getVideoViews(tenantId: string): Promise<StudentVideoTrackingItem[]> {
    return this.fakeVideoViews.get(tenantId) || [];
  }

  async resetVideoView(tenantId: string, studentCode: string): Promise<void> {
    const list = this.fakeVideoViews.get(tenantId) || [];
    this.fakeVideoViews.set(tenantId, list.filter((item) => item.student_code !== studentCode));
  }
}
