export interface TenantPlatformSettings {
  id: string;
  tenant_id: string;
  subdomain: string;
  display_title: string;
  subject_title: string;
  headline_text?: string | null;
  subtitle_text?: string | null;
  cutout_avatar_url?: string | null;
  theme_preset: "navy" | "red" | "emerald" | "purple" | "slate" | string;
  custom_primary_color?: string | null;
  is_active: boolean;
  allow_public_signup: boolean;
  require_approval: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SavePlatformSettingsDto {
  subdomain: string;
  display_title: string;
  subject_title: string;
  headline_text?: string | null;
  subtitle_text?: string | null;
  cutout_avatar_url?: string | null;
  theme_preset?: "navy" | "red" | "emerald" | "purple" | "slate" | string;
  custom_primary_color?: string | null;
  is_active?: boolean;
  allow_public_signup?: boolean;
  require_approval?: boolean;
}

export interface SubdomainAvailabilityResult {
  subdomain: string;
  available: boolean;
  reason?: string;
}

export interface TenantPlanDetails {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  is_pro: boolean;
  is_active: boolean;
}

export interface VideoViewLogDto {
  student_code?: string | null;
  student_name?: string | null;
  student_id?: string | null;
  material_id?: string | null;
  material_title?: string | null;
  progress_percent?: number | null;
  watched_seconds?: number | null;
  duration_seconds?: number | null;
  current_time?: string | null;
  duration_time?: string | null;
  status?: "opened" | "watching" | "completed" | string;
}

export interface StudentVideoTrackingItem {
  id: string;
  student_code: string;
  student_name: string;
  material_title: string;
  progress_percent: number;
  current_time: string;
  duration_time: string;
  status: string;
  updated_at: string;
}

export interface IPlatformBuilderRepository {
  getByTenantId(tenantId: string): Promise<TenantPlatformSettings | null>;
  getBySubdomain(subdomain: string): Promise<TenantPlatformSettings | null>;
  isSubdomainTaken(subdomain: string, excludeTenantId?: string): Promise<boolean>;
  upsert(tenantId: string, settings: SavePlatformSettingsDto): Promise<TenantPlatformSettings>;
  getTenantPlan(tenantId: string): Promise<TenantPlanDetails>;
  getPublicMaterials(tenantId: string): Promise<any[]>;
  recordVideoView(tenantId: string, data: VideoViewLogDto): Promise<void>;
  getVideoViews(tenantId: string): Promise<StudentVideoTrackingItem[]>;
}
