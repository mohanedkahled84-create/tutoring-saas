import { logger } from "../../utils/logger.js";
import { config } from "../../config/index.js";
import {
  IWhatsAppNotificationsRepository,
  JitterConfig,
  DEFAULT_JITTER_CONFIG,
  ConnectionWarmUpInfo,
  WarmUpCheckResult,
  WARMUP_SCHEDULE,
  MAX_DAILY_VOLUME,
  CircuitState,
  HealthStateResult,
  BusinessProfileData,
  ProfileChecklistResult,
  AttendanceWebhookPayload,
  MessageTemplate,
  WhatsAppConnectionStatus,
} from "./types.js";

// Anti-ban Jitter
let lastGeneratedDelay = 0;
export function calculateJitterDelay(jitterConfig: JitterConfig = DEFAULT_JITTER_CONFIG): number {
  const range = jitterConfig.maxDelayMs - jitterConfig.minDelayMs;
  let delay = jitterConfig.minDelayMs + Math.floor(Math.random() * (range + 1));

  if (delay === lastGeneratedDelay) {
    delay += Math.random() > 0.5 ? 47 : -47;
  }
  lastGeneratedDelay = delay;
  return delay;
}

// Anti-ban Warm-up
export function checkWarmUpLimit(
  connection: ConnectionWarmUpInfo,
  sentTodayCount: number
): WarmUpCheckResult {
  if (connection.is_legacy_exempt) {
    return {
      allowed: sentTodayCount < MAX_DAILY_VOLUME,
      day_number: 999,
      daily_limit: MAX_DAILY_VOLUME,
      sent_today: sentTodayCount,
      remaining: Math.max(0, MAX_DAILY_VOLUME - sentTodayCount),
      is_warm: true,
    };
  }

  const connectedDate = new Date(connection.connected_at);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - connectedDate.getTime());
  const dayNumber = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;

  const dailyLimit = WARMUP_SCHEDULE[dayNumber] || MAX_DAILY_VOLUME;
  const isWarm = dayNumber > 6;
  const allowed = sentTodayCount < dailyLimit;

  return {
    allowed,
    day_number: dayNumber,
    daily_limit: dailyLimit,
    sent_today: sentTodayCount,
    remaining: Math.max(0, dailyLimit - sentTodayCount),
    is_warm: isWarm,
    reason: allowed
      ? undefined
      : `Warm-up limit exceeded for Day ${dayNumber} (Limit: ${dailyLimit} msgs/day). Pacing prevents immediate Meta ban.`,
  };
}

// Anti-ban Circuit Breaker
interface HealthState {
  recentErrors: Array<{ type: string; timestamp: number }>;
  circuitState: CircuitState;
  pausedUntil?: number;
}

const tenantHealthMap = new Map<string, HealthState>();
const ERROR_WINDOW_MS = 15 * 60 * 1000;
const MAX_ERRORS_BEFORE_PAUSE = 3;
const PAUSE_DURATION_MS = 30 * 60 * 1000;

export function recordHealthSuccess(tenantId: string): void {
  const state = tenantHealthMap.get(tenantId);
  if (state && state.circuitState !== "CIRCUIT_OPEN_PAUSED") {
    state.recentErrors = [];
    state.circuitState = "HEALTHY";
  }
}

export function recordHealthError(
  tenantId: string,
  errorType: "disconnect" | "rate_limit_429" | "timeout"
): CircuitState {
  const now = Date.now();
  let state = tenantHealthMap.get(tenantId);

  if (!state) {
    state = { recentErrors: [], circuitState: "HEALTHY" };
    tenantHealthMap.set(tenantId, state);
  }

  state.recentErrors = state.recentErrors.filter((e) => now - e.timestamp < ERROR_WINDOW_MS);
  state.recentErrors.push({ type: errorType, timestamp: now });

  if (state.recentErrors.length >= MAX_ERRORS_BEFORE_PAUSE) {
    state.circuitState = "CIRCUIT_OPEN_PAUSED";
    state.pausedUntil = now + PAUSE_DURATION_MS;
    logger.warn(
      `[AntiBanCircuitBreaker] Tenant ${tenantId} PAUSED for 30m due to ${state.recentErrors.length} errors (${errorType})`
    );
  } else if (state.recentErrors.length >= 1) {
    state.circuitState = "DEGRADED";
  }

  return state.circuitState;
}

export function getHealthStatus(tenantId: string): HealthStateResult {
  const state = tenantHealthMap.get(tenantId);
  const now = Date.now();

  if (!state) {
    return { circuit_state: "HEALTHY", can_send: true, error_count: 0 };
  }

  if (state.circuitState === "CIRCUIT_OPEN_PAUSED" && state.pausedUntil) {
    if (now >= state.pausedUntil) {
      state.circuitState = "DEGRADED";
      state.recentErrors = [];
      state.pausedUntil = undefined;
      return { circuit_state: "DEGRADED", can_send: true, error_count: 0 };
    }
    return {
      circuit_state: "CIRCUIT_OPEN_PAUSED",
      can_send: false,
      paused_until: new Date(state.pausedUntil).toISOString(),
      error_count: state.recentErrors.length,
    };
  }

  return {
    circuit_state: state.circuitState,
    can_send: state.circuitState !== "CIRCUIT_OPEN_PAUSED",
    error_count: state.recentErrors.length,
  };
}

// Anti-ban Profile Checklist
export function validateBusinessProfile(profile: BusinessProfileData): ProfileChecklistResult {
  const has_name = Boolean(profile.business_name && profile.business_name.trim().length >= 3);
  const has_profile_picture = Boolean(
    profile.profile_picture_url && profile.profile_picture_url.startsWith("http")
  );
  const has_category = Boolean(profile.category && profile.category.trim().length > 0);
  const has_description = Boolean(profile.description && profile.description.trim().length >= 10);

  const missing: string[] = [];
  if (!has_name) missing.push("اسم النشاط التجاري (Business Name >= 3 chars)");
  if (!has_profile_picture) missing.push("صورة الملف التعريفي للواتساب (Profile Picture URL)");
  if (!has_category) missing.push("فئة النشاط (Category, e.g. Education / مركز تعليمي)");
  if (!has_description) missing.push("وصف النشاط التجاري (Description >= 10 chars)");

  const passedCount = [has_name, has_profile_picture, has_category, has_description].filter(
    Boolean
  ).length;
  const score = Math.round((passedCount / 4) * 100);

  return {
    is_compliant: missing.length === 0,
    score_percentage: score,
    checklist: {
      has_name,
      has_profile_picture,
      has_category,
      has_description,
    },
    missing_requirements: missing,
  };
}

// In-memory cache of dispatched idempotency keys for fast deduplication
const dispatchedKeys = new Set<string>();

export class WhatsAppNotificationsService {
  constructor(private readonly repository: IWhatsAppNotificationsRepository) {}

  /**
   * DEV-WPA.3: Triggers the n8n attendance webhook exactly once per idempotency_key.
   */
  async dispatchAttendanceWebhook(payload: AttendanceWebhookPayload): Promise<boolean> {
    const { idempotency_key, attended, comment } = payload;

    if (attended === true && (!comment || comment.trim() === "")) {
      logger.info(
        `[WhatsAppService] Skipping present student without comment: ${payload.student_name}`
      );
      return false;
    }

    if (dispatchedKeys.has(idempotency_key)) {
      logger.info(
        `[WhatsAppService] Webhook already dispatched for key (in-memory): ${idempotency_key}`
      );
      return false;
    }

    const alreadyInDb = await this.repository.isMessageDispatched(idempotency_key);
    if (alreadyInDb) {
      dispatchedKeys.add(idempotency_key);
      logger.info(
        `[WhatsAppService] Webhook already logged in database for key: ${idempotency_key}`
      );
      return false;
    }

    dispatchedKeys.add(idempotency_key);
    const webhookUrl = process.env.N8N_ATTENDANCE_WEBHOOK_URL;

    if (!webhookUrl) {
      logger.info(
        `[WhatsAppService] [SIMULATED] n8n webhook triggered for ${payload.student_name} (${idempotency_key})`
      );
      return true;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": config.internalApiSecret,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        logger.warn(
          `[WhatsAppService] n8n returned non-200 status (${response.status}) for ${idempotency_key}`
        );
        return false;
      }

      logger.info(
        `[WhatsAppService] Webhook successfully delivered to n8n for ${payload.student_name} (${idempotency_key})`
      );
      return true;
    } catch (err: unknown) {
      logger.error(
        `[WhatsAppService] Failed to dispatch webhook to n8n for ${idempotency_key}: ${(err as Error).message}`
      );
      return false;
    }
  }

  async listTemplates(tenantId?: string): Promise<MessageTemplate[]> {
    return this.repository.getTemplates(tenantId);
  }

  async saveTemplate(
    tenantId: string,
    templateType: string,
    variants: unknown,
    isActive = true
  ): Promise<MessageTemplate> {
    return this.repository.upsertTemplate({
      tenant_id: tenantId,
      template_type: templateType,
      variants,
      is_active: isActive,
    });
  }

  async getConnectionStatus(tenantId?: string): Promise<WhatsAppConnectionStatus> {
    return this.repository.getConnectionStatus(tenantId);
  }
}
