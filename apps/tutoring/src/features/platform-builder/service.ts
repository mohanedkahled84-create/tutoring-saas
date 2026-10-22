import {
  TenantPlatformSettings,
  SavePlatformSettingsDto,
  SubdomainAvailabilityResult,
  IPlatformBuilderRepository,
  TenantPlanDetails,
} from "./types.js";

const RESERVED_SUBDOMAINS = new Set([
  "api",
  "admin",
  "portal",
  "www",
  "centrly",
  "root",
  "app",
  "auth",
  "mail",
  "support",
  "help",
  "static",
  "assets",
  "cdn",
  "test",
  "demo",
  "staging",
  "billing",
  "webhook",
  "dashboard",
]);

export class PlatformBuilderService {
  constructor(private readonly repository: IPlatformBuilderRepository) {}

  /**
   * Validates subdomain format and checks reserved words
   */
  validateSubdomainFormat(subdomain: string): { valid: boolean; error?: string } {
    if (!subdomain || typeof subdomain !== "string") {
      return { valid: false, error: "يجب إدخال اسم الرابط (السب دومين)" };
    }

    const clean = subdomain.trim().toLowerCase();

    if (clean.length < 3) {
      return { valid: false, error: "يجب ألا يقل اسم الرابط عن 3 أحرف" };
    }

    if (clean.length > 30) {
      return { valid: false, error: "يجب ألا يزيد اسم الرابط عن 30 حرفاً" };
    }

    // Must start and end with alphanumeric character, can contain hyphens in between
    const regex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
    if (!regex.test(clean)) {
      return {
        valid: false,
        error: "يجب أن يتكون الرابط من حروف إنجليزية وأرقام وعلامة الشرطة (-) فقط دون مسافات أو رموز خاصة",
      };
    }

    if (RESERVED_SUBDOMAINS.has(clean)) {
      return { valid: false, error: "هذا الاسم محجوز للنظام ولا يمكن اختياره" };
    }

    return { valid: true };
  }

  /**
   * Checks if a subdomain is available to be claimed
   */
  async checkSubdomainAvailability(
    subdomain: string,
    currentTenantId?: string
  ): Promise<SubdomainAvailabilityResult> {
    const clean = (subdomain || "").trim().toLowerCase();
    const formatCheck = this.validateSubdomainFormat(clean);

    if (!formatCheck.valid) {
      return {
        subdomain: clean,
        available: false,
        reason: formatCheck.error,
      };
    }

    const taken = await this.repository.isSubdomainTaken(clean, currentTenantId);
    if (taken) {
      return {
        subdomain: clean,
        available: false,
        reason: "هذا الرابط مستخدم بالفعل من معلم آخر",
      };
    }

    return {
      subdomain: clean,
      available: true,
    };
  }

  /**
   * Retrieves public platform settings for student portal / visitors
   */
  async getPublicSettings(subdomain: string): Promise<TenantPlatformSettings | null> {
    if (!subdomain) return null;
    const clean = subdomain.trim().toLowerCase();
    const settings = await this.repository.getBySubdomain(clean);
    if (!settings || !settings.is_active) {
      return null;
    }
    return settings;
  }

  /**
   * Retrieves settings and plan eligibility for the logged-in teacher
   */
  async getTeacherSettings(
    tenantId: string,
    isAdminOrOmar: boolean = false
  ): Promise<{ settings: TenantPlatformSettings | null; plan: TenantPlanDetails }> {
    const [settings, plan] = await Promise.all([
      this.repository.getByTenantId(tenantId),
      this.repository.getTenantPlan(tenantId),
    ]);

    if (isAdminOrOmar) {
      plan.is_pro = true;
      plan.is_active = true;
    }

    return { settings, plan };
  }

  /**
   * Saves or publishes teacher platform settings with PRO plan verification
   */
  async savePlatformSettings(
    tenantId: string,
    dto: SavePlatformSettingsDto,
    isAdminOrOmar: boolean = false
  ): Promise<TenantPlatformSettings> {
    // 1. Verify PRO plan subscription requirement
    const plan = await this.repository.getTenantPlan(tenantId);
    if (!plan.is_pro && !isAdminOrOmar) {
      const err = new Error(
        "ميزة تفعيل ونشر منصتك الخاصة متاحة فقط لمشتركي باقة برو (Pro Plan)"
      );
      (err as any).statusCode = 403;
      (err as any).code = "PRO_REQUIRED";
      throw err;
    }

    // 2. Validate input fields
    const cleanSubdomain = (dto.subdomain || "").trim().toLowerCase();
    const formatCheck = this.validateSubdomainFormat(cleanSubdomain);
    if (!formatCheck.valid) {
      const err = new Error(formatCheck.error);
      (err as any).statusCode = 400;
      throw err;
    }

    if (!dto.display_title || !dto.display_title.trim()) {
      const err = new Error("يجب كتابة اسم المنصة الرسمي");
      (err as any).statusCode = 400;
      throw err;
    }

    if (!dto.subject_title || !dto.subject_title.trim()) {
      const err = new Error("يجب كتابة تخصص المعلم والمرحلة الدراسية");
      (err as any).statusCode = 400;
      throw err;
    }

    // 3. Check uniqueness of subdomain
    const taken = await this.repository.isSubdomainTaken(cleanSubdomain, tenantId);
    if (taken) {
      const err = new Error("هذا الرابط مستخدم بالفعل من معلم آخر");
      (err as any).statusCode = 409;
      throw err;
    }

    // 4. Upsert settings
    const payload: SavePlatformSettingsDto = {
      ...dto,
      subdomain: cleanSubdomain,
      display_title: dto.display_title.trim(),
      subject_title: dto.subject_title.trim(),
      headline_text: dto.headline_text ? dto.headline_text.trim() : null,
      subtitle_text: dto.subtitle_text ? dto.subtitle_text.trim() : null,
      theme_preset: dto.theme_preset || "navy",
      is_active: dto.is_active !== false,
      allow_public_signup: dto.allow_public_signup !== false,
      require_approval: Boolean(dto.require_approval),
    };

    return await this.repository.upsert(tenantId, payload);
  }
}
