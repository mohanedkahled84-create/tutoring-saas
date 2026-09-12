import { logger } from "../../shared/utils/logger.js";
import { config } from "../../shared/config/index.js";
import { dispatchCriticalErrorAlert } from "../admin-ops/criticalErrorAlert.js";
import {
  IWhatsAppNotificationsRepository,
  JitterConfig,
  DEFAULT_JITTER_CONFIG,
  INITIAL_JITTER_CONFIG,
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
  buildInstanceName,
} from "./types.js";
import { IEvolutionGateway, EvolutionQrResult } from "./gateway.js";

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

export function calculateInitialJitterDelay(jitterConfig: JitterConfig = INITIAL_JITTER_CONFIG): number {
  const range = jitterConfig.maxDelayMs - jitterConfig.minDelayMs;
  return jitterConfig.minDelayMs + Math.floor(Math.random() * (range + 1));
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

    // DEV-51: Ops Alerting - Page founder when WhatsApp circuit breaker opens
    dispatchCriticalErrorAlert({
      severity: "CRITICAL",
      error_name: "WhatsAppCircuitBreakerTripped",
      error_message: `WhatsApp Anti-Ban Circuit Breaker tripped for tenant ${tenantId} due to ${state.recentErrors.length} consecutive errors (${errorType}). Message sending paused for 30m to protect account from Meta ban.`,
      context: {
        tenant_id: tenantId,
        details: { errorType, pauseDurationMinutes: 30 },
      },
    }).catch((err) => {
      logger.error("[OpsAlert] Failed to dispatch circuit breaker alert:", err);
    });
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
  constructor(
    private readonly repository: IWhatsAppNotificationsRepository,
    private readonly gateway?: IEvolutionGateway
  ) {}

  /**
   * DEV-WPA.3: Triggers the n8n attendance webhook exactly once per idempotency_key.
   */
  async dispatchAttendanceWebhook(payload: AttendanceWebhookPayload): Promise<boolean> {
    const { idempotency_key, attended, comment, force_send } = payload;

    if (!force_send && attended === true && (!comment || comment.trim() === "")) {
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

    // 1. Send real message via Evolution API Gateway if configured
    let gatewaySent = false;
    if (this.gateway?.sendTextMessage && payload.parent_phone) {
      const teacherId = payload.teacher_id || "default";
      const primaryInstance = buildInstanceName(payload.tenant_id, teacherId);
      const fallbackInstance = buildInstanceName(payload.tenant_id, "default");

      const text = generateAttendanceMessage({
        student_name: payload.student_name || "الطالب",
        attended: payload.attended,
        comment: payload.comment,
        homework_status: payload.homework_status,
      });

      try {
        if (this.gateway.sendPresence) {
          await this.gateway.sendPresence(primaryInstance, payload.parent_phone, "composing").catch(() => {});
          if (process.env.NODE_ENV !== "test") {
            const typingDuration = 2000 + Math.floor(Math.random() * 1500);
            await new Promise((r) => setTimeout(r, typingDuration));
          }
        }

        let gwRes = await this.gateway.sendTextMessage(primaryInstance, payload.parent_phone, text);
        if (!gwRes.success && primaryInstance !== fallbackInstance) {
          logger.info(`[WhatsAppService] Retrying sendTextMessage with fallback instance ${fallbackInstance}`);
          gwRes = await this.gateway.sendTextMessage(fallbackInstance, payload.parent_phone, text);
        }
        const globalInstance = config.evolutionInstanceName;
        if (!gwRes.success && globalInstance && globalInstance !== primaryInstance && globalInstance !== fallbackInstance) {
          logger.info(`[WhatsAppService] Retrying sendTextMessage with global instance ${globalInstance}`);
          gwRes = await this.gateway.sendTextMessage(globalInstance, payload.parent_phone, text);
        }

        if (gwRes.success) {
          logger.info(`[WhatsAppService] Real message sent to ${payload.parent_phone} for ${payload.student_name}`);
          gatewaySent = true;
        } else {
          logger.warn(`[WhatsAppService] Gateway send failed for ${payload.parent_phone}: ${gwRes.error}`);
        }
      } catch (gwErr) {
        logger.warn(`[WhatsAppService] Gateway send error: ${(gwErr as Error).message}`);
      }
    }

    const webhookUrl = process.env.N8N_ATTENDANCE_WEBHOOK_URL;

    if (!webhookUrl) {
      logger.info(
        `[WhatsAppService] n8n webhook not configured; ${gatewaySent ? 'dispatched via gateway' : 'simulated/skipped'} for ${payload.student_name} (${idempotency_key})`
      );
      return this.gateway ? gatewaySent : true;
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
        return gatewaySent;
      }

      logger.info(
        `[WhatsAppService] Webhook successfully delivered to n8n for ${payload.student_name} (${idempotency_key})`
      );
      return true;
    } catch (err: unknown) {
      logger.error(
        `[WhatsAppService] Failed to dispatch webhook to n8n for ${idempotency_key}: ${(err as Error).message}`
      );
      return gatewaySent;
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

  async getQrCode(tenantId: string, teacherId: string): Promise<EvolutionQrResult> {
    const instanceName = buildInstanceName(tenantId, teacherId);
    if (this.gateway) {
      return this.gateway.getQrCode(instanceName);
    }
    return {
      instance_name: instanceName,
      status: "pending",
      qr_base64:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      pairing_code: "1234-5678",
      expires_in_seconds: 30,
    };
  }

  async getConnectionStatus(
    tenantId?: string,
    teacherId?: string
  ): Promise<WhatsAppConnectionStatus> {
    const baseStatus = await this.repository.getConnectionStatus(tenantId, teacherId);

    if (tenantId && teacherId && this.gateway) {
      const instanceName = buildInstanceName(tenantId, teacherId);
      const state = await this.gateway.getConnectionState(instanceName);
      return {
        ...baseStatus,
        instance_name: instanceName,
        status: state.status,
        phone_number: state.phone_number || baseStatus.phone_number,
        latency_ms: state.latency_ms ?? baseStatus.latency_ms,
      };
    }

    if (tenantId && teacherId) {
      return {
        ...baseStatus,
        instance_name: buildInstanceName(tenantId, teacherId),
      };
    }

    return baseStatus;
  }

  async disconnect(
    tenantId: string,
    teacherId: string
  ): Promise<{
    success: boolean;
    message: string;
    instance_name: string;
    status: string;
  }> {
    const instanceName = buildInstanceName(tenantId, teacherId);
    if (this.gateway) {
      await this.gateway.disconnectInstance(instanceName);
    }

    if (this.repository.upsertConnection) {
      try {
        await this.repository.upsertConnection({
          tenant_id: tenantId,
          teacher_id: teacherId,
          provider: "evolution",
          instance_url: "",
          instance_status: "disconnected",
        });
      } catch {
        // Ignore repo errors in in-memory test environments
      }
    }

    return {
      success: true,
      message: "WhatsApp instance disconnected. Scan QR to reconnect.",
      instance_name: instanceName,
      status: "disconnected",
    };
  }

  async sendTestMessage(
    tenantId: string,
    teacherId: string,
    phone: string,
    message: string
  ): Promise<{
    success: boolean;
    recipient: string;
    message: string;
    sent_at: string;
    warning?: string;
  }> {
    const instanceName = buildInstanceName(tenantId, teacherId);
    const conn = await this.getConnectionStatus(tenantId, teacherId);

    if (conn.status !== "connected") {
      throw new Error(
        "حساب الواتساب غير متصل حالياً. يرجى مسح رمز QR من صفحة الإعدادات وربط جهازك أولاً لتتمكن من إرسال الرسائل لهاتفك."
      );
    }

    if (this.gateway?.sendTextMessage) {
      const result = await this.gateway.sendTextMessage(instanceName, phone, message);
      if (!result.success) {
        throw new Error(`تعذر إرسال الرسالة عبر خادم الواتساب: ${result.error || "خطأ غير معروف"}`);
      }
    }

    return {
      success: true,
      recipient: phone,
      message,
      sent_at: new Date().toISOString(),
    };
  }

  /**
   * DEV-36: WhatsApp Send Pacing & Batch Queue Strategy
   * Loops through batch with 4-9s jitter delay, checks daily volume cap,
   * checks circuit breaker, and enforces idempotency.
   */
  async batchSendWithPacing(
    tenantId: string,
    items: Array<{
      student_id: string;
      student_name: string;
      parent_phone: string;
      session_id: string;
      attended: boolean;
      comment?: string | null;
      idempotency_key: string;
      teacher_id?: string | null;
      homework_status?: string | null;
    }>,
    options?: {
      pacingDelayMs?: number;
      dailyCap?: number;
      teacher_id?: string | null;
      force_send?: boolean;
      include_all_present?: boolean;
    }
  ): Promise<{
    total: number;
    sent_count: number;
    skipped_count: number;
    failed_count: number;
    daily_quota: {
      sent_today: number;
      daily_limit: number;
      remaining: number;
      cap_reached: boolean;
      approaching_cap: boolean;
      warning?: string;
    };
    results: Array<{
      student_id: string;
      student_name: string;
      status: "sent" | "failed" | "skipped_daily_cap" | "skipped_circuit_open" | "skipped_no_comment";
      error?: string;
      delay_applied_ms?: number;
    }>;
  }> {
    const dailyCap = options?.dailyCap || DEFAULT_SAFE_DAILY_CAP;
    const results: Array<{
      student_id: string;
      student_name: string;
      status: "sent" | "failed" | "skipped_daily_cap" | "skipped_circuit_open" | "skipped_no_comment";
      error?: string;
      delay_applied_ms?: number;
    }> = [];

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 1. Check Circuit Breaker
      const health = getHealthStatus(tenantId);
      if (!health.can_send) {
        skippedCount += 1;
        results.push({
          student_id: item.student_id,
          student_name: item.student_name,
          status: "skipped_circuit_open",
          error: `Circuit breaker is paused until ${health.paused_until || "unknown"}`,
        });
        continue;
      }

      // 2. Check Daily Volume Cap
      const currentQuota = getDailyQuotaStatus(tenantId, dailyCap);
      if (currentQuota.cap_reached) {
        skippedCount += 1;
        results.push({
          student_id: item.student_id,
          student_name: item.student_name,
          status: "skipped_daily_cap",
          error: `Daily volume cap of ${dailyCap} reached for tenant. Further sends halted to prevent Meta ban.`,
        });
        continue;
      }

      // 3. Apply Jitter Delay
      let delayApplied = 0;
      if (i === 0) {
        // Initial delay before first message (5 to 10s) to avoid instantaneous bot dispatch
        const initialDelay =
          options?.pacingDelayMs === 0
            ? 0
            : calculateInitialJitterDelay();

        if (initialDelay > 0) {
          logger.info(
            `[WhatsAppPacing] Initial Anti-Ban Jitter applied: waiting ${initialDelay}ms (${(initialDelay / 1000).toFixed(1)}s) before sending first message to ${item.student_name} (${item.parent_phone})`
          );
          await new Promise((resolve) => setTimeout(resolve, initialDelay));
          delayApplied = initialDelay;
        }
      } else {
        // Batch break: every 10th message, add natural rest pause (60-90s) unless test pacingDelayMs is set
        if (i % 10 === 0 && options?.pacingDelayMs === undefined) {
          const breakDelay = 60000 + Math.floor(Math.random() * 30000);
          logger.info(
            `[WhatsAppPacing] Batch Rest Break applied: pausing for ${(breakDelay / 1000).toFixed(0)}s after 10 messages to mimic human behavior.`
          );
          await new Promise((resolve) => setTimeout(resolve, breakDelay));
        }

        delayApplied = options?.pacingDelayMs !== undefined ? options.pacingDelayMs : calculateJitterDelay();
        if (delayApplied > 0) {
          logger.info(
            `[WhatsAppPacing] Anti-Ban Jitter applied: waiting ${delayApplied}ms (${(delayApplied / 1000).toFixed(1)}s) before sending message ${i + 1}/${items.length} to ${item.student_name} (${item.parent_phone})`
          );
          await new Promise((resolve) => setTimeout(resolve, delayApplied));
        }
      }

      // 4. Dispatch Webhook
      try {
        const delivered = await this.dispatchAttendanceWebhook({
          tenant_id: tenantId,
          event_type: "attendance_recorded",
          student_id: item.student_id,
          student_name: item.student_name,
          session_id: item.session_id,
          attended: item.attended,
          comment: item.comment || null,
          homework_status: item.homework_status || null,
          parent_phone: item.parent_phone,
          idempotency_key: item.idempotency_key,
          teacher_id: item.teacher_id || options?.teacher_id || null,
          force_send: options?.force_send ?? true,
        });

        if (delivered) {
          sentCount += 1;
          incrementTenantDailyCount(tenantId, 1);
          recordHealthSuccess(tenantId);
          results.push({
            student_id: item.student_id,
            student_name: item.student_name,
            status: "sent",
            delay_applied_ms: delayApplied,
          });
        } else {
          failedCount += 1;
          results.push({
            student_id: item.student_id,
            student_name: item.student_name,
            status: "failed",
            error: "تعذر إرسال الإشعار لولي الأمر عبر بوابة واتساب",
            delay_applied_ms: delayApplied,
          });
        }
      } catch (err: unknown) {
        failedCount += 1;
        recordHealthError(tenantId, "timeout");
        results.push({
          student_id: item.student_id,
          student_name: item.student_name,
          status: "failed",
          error: (err as Error).message,
          delay_applied_ms: delayApplied,
        });
      }
    }

    return {
      total: items.length,
      sent_count: sentCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      daily_quota: getDailyQuotaStatus(tenantId, dailyCap),
      results,
    };
  }

  /**
   * DEV-QUIZ.1: Send single student quiz score via WhatsApp with dynamic variation & anti-ban protection.
   */
  /**
   * Helper to dispatch a single text message through the Evolution gateway
   * with instance fallback, simulated presence, quota accounting, and circuit breaker health reporting.
   */
  private async deliverSingleTextMessage(params: {
    tenant_id: string;
    teacher_id?: string | null;
    recipient_phone: string;
    message_text: string;
  }): Promise<{ success: boolean; error?: string; gateway_sent: boolean }> {
    const { tenant_id, teacher_id, recipient_phone, message_text } = params;
    let gatewaySent = false;

    if (this.gateway?.sendTextMessage && recipient_phone) {
      const actualTeacherId = teacher_id || "default";
      const primaryInstance = buildInstanceName(tenant_id, actualTeacherId);
      const fallbackInstance = buildInstanceName(tenant_id, "default");

      try {
        if (this.gateway.sendPresence) {
          await this.gateway.sendPresence(primaryInstance, recipient_phone, "composing").catch(() => {});
          if (process.env.NODE_ENV !== "test") {
            const typingDuration = 2000 + Math.floor(Math.random() * 1500);
            await new Promise((r) => setTimeout(r, typingDuration));
          }
        }

        let gwRes = await this.gateway.sendTextMessage(primaryInstance, recipient_phone, message_text);
        if (!gwRes.success && primaryInstance !== fallbackInstance) {
          logger.info(
            `[WhatsAppService] Retrying with fallback instance ${fallbackInstance}`
          );
          gwRes = await this.gateway.sendTextMessage(fallbackInstance, recipient_phone, message_text);
        }
        const globalInstance = config.evolutionInstanceName;
        if (!gwRes.success && globalInstance && globalInstance !== primaryInstance && globalInstance !== fallbackInstance) {
          logger.info(`[WhatsAppService] Retrying with global instance ${globalInstance}`);
          gwRes = await this.gateway.sendTextMessage(globalInstance, recipient_phone, message_text);
        }

        if (gwRes.success) {
          gatewaySent = true;
          incrementTenantDailyCount(tenant_id, 1);
          recordHealthSuccess(tenant_id);
          return { success: true, gateway_sent: true };
        } else {
          recordHealthError(tenant_id, "disconnect");
          return {
            success: false,
            error: gwRes.error || "Evolution gateway failed to send text message",
            gateway_sent: false,
          };
        }
      } catch (gwErr) {
        recordHealthError(tenant_id, "timeout");
        return {
          success: false,
          error: (gwErr as Error).message,
          gateway_sent: false,
        };
      }
    } else {
      // In test or non-gateway environment
      gatewaySent = true;
      incrementTenantDailyCount(tenant_id, 1);
      recordHealthSuccess(tenant_id);
      return { success: true, gateway_sent: true };
    }
  }

  /**
   * DEV-QUIZ.1: Send single student quiz score via WhatsApp with dynamic variation & anti-ban protection.
   * Supports parent-facing, student-facing, or dual dispatch.
   */
  async sendQuizScore(params: {
    tenant_id: string;
    teacher_id?: string | null;
    student_id: string;
    student_name: string;
    parent_phone?: string;
    student_phone?: string;
    recipient_type?: "parent" | "student" | "both";
    quiz_title: string;
    score: number;
    max_score?: number;
    teacher_name?: string;
    note?: string;
    custom_message?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    message_text: string;
    recipient: string;
    gateway_sent: boolean;
    sent_to?: ("parent" | "student")[];
    student_message_text?: string;
    student_recipient?: string;
  }> {
    const {
      tenant_id,
      teacher_id,
      student_id,
      student_name,
      parent_phone,
      student_phone,
      recipient_type = "both",
      quiz_title,
      score,
      max_score = 10,
      teacher_name,
      note,
      custom_message,
    } = params;

    const cleanParentPhone = (parent_phone || "").replace(/[\s\-\(\)\.]/g, "");
    const cleanStudentPhone = (student_phone || "").replace(/[\s\-\(\)\.]/g, "");

    // 1. Check Circuit Breaker
    const health = getHealthStatus(tenant_id);
    if (!health.can_send) {
      return {
        success: false,
        error: `Circuit breaker is paused until ${health.paused_until || "unknown"}`,
        message_text: "",
        recipient: cleanParentPhone || cleanStudentPhone || "",
        gateway_sent: false,
      };
    }

    // 2. Check Daily Volume Cap
    const currentQuota = getDailyQuotaStatus(tenant_id);
    if (currentQuota.cap_reached) {
      return {
        success: false,
        error: `Daily volume cap reached for tenant. Sending paused to prevent ban.`,
        message_text: "",
        recipient: cleanParentPhone || cleanStudentPhone || "",
        gateway_sent: false,
      };
    }

    // 3. Determine target phone list
    const targets: Array<{ type: "parent" | "student"; phone: string }> = [];
    if (recipient_type === "parent" || recipient_type === "both") {
      if (cleanParentPhone.length >= 8) {
        targets.push({ type: "parent", phone: cleanParentPhone });
      }
    }
    if (recipient_type === "student" || recipient_type === "both") {
      if (cleanStudentPhone.length >= 8) {
        targets.push({ type: "student", phone: cleanStudentPhone });
      }
    }

    if (targets.length === 0) {
      const targetLabel = recipient_type === "student" ? "هاتف الطالب" : recipient_type === "parent" ? "هاتف ولي الأمر" : "هاتف الطالب أو ولي الأمر";
      return {
        success: false,
        error: `لم يتم العثور على رقم صحيح لـ (${targetLabel}) لإرسال النتيجة`,
        message_text: "",
        recipient: cleanParentPhone || cleanStudentPhone || "",
        gateway_sent: false,
      };
    }

    let primaryMessageText = "";
    let primaryRecipient = "";
    let studentMessageText: string | undefined;
    let studentRecipient: string | undefined;
    const sentTo: ("parent" | "student")[] = [];
    let lastError: string | undefined;
    let anyGatewaySent = false;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const msgText =
        custom_message ||
        generateQuizScoreMessage({
          student_name,
          quiz_title,
          score,
          max_score,
          teacher_name,
          note,
          recipient_type: target.type,
        });

      if (target.type === "parent") {
        primaryMessageText = msgText;
        primaryRecipient = target.phone;
      } else {
        studentMessageText = msgText;
        studentRecipient = target.phone;
        if (!primaryMessageText) {
          primaryMessageText = msgText;
          primaryRecipient = target.phone;
        }
      }

      // Between sending to parent and student for the same student, add natural human pause
      if (i > 0 && process.env.NODE_ENV !== "test") {
        const typingDuration = 1500 + Math.floor(Math.random() * 1500);
        await new Promise((r) => setTimeout(r, typingDuration));
      }

      const deliverRes = await this.deliverSingleTextMessage({
        tenant_id,
        teacher_id,
        recipient_phone: target.phone,
        message_text: msgText,
      });

      if (deliverRes.success) {
        sentTo.push(target.type);
        if (deliverRes.gateway_sent) anyGatewaySent = true;
      } else {
        lastError = deliverRes.error;
      }
    }

    const isSuccess = sentTo.length > 0;
    return {
      success: isSuccess,
      error: isSuccess ? undefined : (lastError || "Failed to deliver quiz score message"),
      message_text: primaryMessageText,
      recipient: primaryRecipient,
      gateway_sent: anyGatewaySent,
      sent_to: sentTo,
      student_message_text: studentMessageText,
      student_recipient: studentRecipient,
    };
  }

  /**
   * DEV-QUIZ.2: Batch send quiz scores with Anti-Ban jitter delay, volume checks & dynamic variations.
   */
  async batchSendQuizScores(
    tenantId: string,
    items: Array<{
      student_id: string;
      student_name: string;
      parent_phone: string;
      student_phone?: string;
      score: number;
      note?: string;
    }>,
    options: {
      quiz_title: string;
      max_score?: number;
      teacher_id?: string | null;
      teacher_name?: string;
      pacingDelayMs?: number;
      dailyCap?: number;
      target?: "parents" | "students" | "both";
    }
  ): Promise<{
    total: number;
    sent_count: number;
    skipped_count: number;
    failed_count: number;
    daily_quota: {
      sent_today: number;
      daily_limit: number;
      remaining: number;
      cap_reached: boolean;
      approaching_cap: boolean;
      warning?: string;
    };
    results: Array<{
      student_id: string;
      student_name: string;
      status: "sent" | "failed" | "skipped_daily_cap" | "skipped_circuit_open";
      error?: string;
      delay_applied_ms?: number;
      message_text?: string;
    }>;
  }> {
    const dailyCap = options?.dailyCap || DEFAULT_SAFE_DAILY_CAP;
    const results: Array<{
      student_id: string;
      student_name: string;
      status: "sent" | "failed" | "skipped_daily_cap" | "skipped_circuit_open";
      error?: string;
      delay_applied_ms?: number;
      message_text?: string;
    }> = [];

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 1. Check Circuit Breaker
      const health = getHealthStatus(tenantId);
      if (!health.can_send) {
        skippedCount += 1;
        results.push({
          student_id: item.student_id,
          student_name: item.student_name,
          status: "skipped_circuit_open",
          error: `Circuit breaker is paused until ${health.paused_until || "unknown"}`,
        });
        continue;
      }

      // 2. Check Daily Volume Cap
      const currentQuota = getDailyQuotaStatus(tenantId, dailyCap);
      if (currentQuota.cap_reached) {
        skippedCount += 1;
        results.push({
          student_id: item.student_id,
          student_name: item.student_name,
          status: "skipped_daily_cap",
          error: `Daily volume cap of ${dailyCap} reached for tenant. Further sends halted to prevent Meta ban.`,
        });
        continue;
      }

      // 3. Apply Ultra Anti-Ban Pacing Delay
      let delayApplied = 0;
      if (i === 0) {
        // Initial delay before first message (5 to 10s) to avoid instantaneous bot dispatch
        const initialDelay =
          options?.pacingDelayMs === 0
            ? 0
            : calculateInitialJitterDelay();

        if (initialDelay > 0) {
          logger.info(
            `[WhatsAppPacing] Initial Anti-Ban Jitter applied: waiting ${initialDelay}ms (${(initialDelay / 1000).toFixed(1)}s) before sending first quiz score to ${item.student_name} (${item.parent_phone})`
          );
          await new Promise((resolve) => setTimeout(resolve, initialDelay));
          delayApplied = initialDelay;
        }
      } else {
        // Batch break: every 10th message, add natural rest pause (60-90s) unless test pacingDelayMs is set
        if (i % 10 === 0 && options?.pacingDelayMs === undefined) {
          const breakDelay = 60000 + Math.floor(Math.random() * 30000);
          logger.info(
            `[WhatsAppPacing] Batch Rest Break applied: pausing for ${(breakDelay / 1000).toFixed(0)}s after 10 messages to mimic human behavior.`
          );
          await new Promise((resolve) => setTimeout(resolve, breakDelay));
        }

        delayApplied =
          options?.pacingDelayMs !== undefined
            ? options.pacingDelayMs
            : calculateJitterDelay();
        if (delayApplied > 0) {
          logger.info(
            `[WhatsAppPacing] Anti-Ban Jitter applied: waiting ${delayApplied}ms (${(delayApplied / 1000).toFixed(1)}s) before sending quiz score ${i + 1}/${items.length} to ${item.student_name} (${item.parent_phone})`
          );
          await new Promise((resolve) => setTimeout(resolve, delayApplied));
        }
      }

      // 4. Send Quiz Score Message
      try {
        const recipientType =
          options?.target === "parents"
            ? "parent"
            : options?.target === "students"
            ? "student"
            : "both";

        const sendRes = await this.sendQuizScore({
          tenant_id: tenantId,
          teacher_id: options.teacher_id,
          student_id: item.student_id,
          student_name: item.student_name,
          parent_phone: item.parent_phone,
          student_phone: item.student_phone,
          recipient_type: recipientType,
          quiz_title: options.quiz_title,
          score: item.score,
          max_score: options.max_score,
          teacher_name: options.teacher_name,
          note: item.note,
        });

        if (sendRes.success) {
          sentCount += 1;
          results.push({
            student_id: item.student_id,
            student_name: item.student_name,
            status: "sent",
            delay_applied_ms: delayApplied,
            message_text: sendRes.message_text,
          });
        } else {
          failedCount += 1;
          results.push({
            student_id: item.student_id,
            student_name: item.student_name,
            status: "failed",
            error: sendRes.error,
            delay_applied_ms: delayApplied,
            message_text: sendRes.message_text,
          });
        }
      } catch (err: unknown) {
        failedCount += 1;
        recordHealthError(tenantId, "timeout");
        results.push({
          student_id: item.student_id,
          student_name: item.student_name,
          status: "failed",
          error: (err as Error).message,
          delay_applied_ms: delayApplied,
        });
      }
    }

    return {
      total: items.length,
      sent_count: sentCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      daily_quota: getDailyQuotaStatus(tenantId, dailyCap),
      results,
    };
  }

  /**
   * DEV-PORTAL.1: Send parent tracking portal link to a single student's parent via WhatsApp.
   */
  async sendParentPortalLink(params: {
    tenant_id: string;
    teacher_id?: string | null;
    student_id: string;
    student_name: string;
    parent_phone: string;
    teacher_name?: string;
    portal_url: string;
  }): Promise<{
    success: boolean;
    error?: string;
    message_text: string;
    recipient: string;
    gateway_sent: boolean;
  }> {
    const { tenant_id, teacher_id, student_name, parent_phone, teacher_name, portal_url } = params;
    const cleanPhone = (parent_phone || "").replace(/[\s\-\(\)\.]/g, "");
    if (!cleanPhone) {
      return {
        success: false,
        error: "رقم هاتف ولي الأمر غير متوفر",
        message_text: "",
        recipient: "",
        gateway_sent: false,
      };
    }

    const health = getHealthStatus(tenant_id);
    if (!health.can_send) {
      return {
        success: false,
        error: `Circuit breaker is paused until ${health.paused_until || "unknown"}`,
        message_text: "",
        recipient: cleanPhone,
        gateway_sent: false,
      };
    }

    const quota = getDailyQuotaStatus(tenant_id);
    if (quota.cap_reached) {
      return {
        success: false,
        error: "Daily volume cap reached for tenant. Sending paused to prevent ban.",
        message_text: "",
        recipient: cleanPhone,
        gateway_sent: false,
      };
    }

    const messageText = generateParentPortalInviteMessage({
      student_name,
      teacher_name: teacher_name || undefined,
      portal_url,
    });

    const res = await this.deliverSingleTextMessage({
      tenant_id,
      teacher_id,
      recipient_phone: cleanPhone,
      message_text: messageText,
    });

    return {
      success: res.success,
      error: res.error,
      message_text: messageText,
      recipient: cleanPhone,
      gateway_sent: res.gateway_sent,
    };
  }

  /**
   * DEV-PORTAL.2: Batch send parent tracking portal links to new students with anti-ban pacing and pauses.
   */
  async batchSendParentPortalLinks(params: {
    tenant_id: string;
    teacher_id?: string | null;
    teacher_name?: string;
    students: Array<{
      student_id: string;
      student_name: string;
      parent_phone: string;
      portal_url: string;
    }>;
    pacingDelayMs?: number;
  }): Promise<{
    total: number;
    sent_count: number;
    failed_count: number;
    results: Array<{
      student_id: string;
      student_name: string;
      status: "sent" | "failed";
      error?: string;
      delay_applied_ms?: number;
      message_text?: string;
    }>;
  }> {
    const { tenant_id, teacher_id, teacher_name, students, pacingDelayMs } = params;
    const results: Array<any> = [];
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < students.length; i++) {
      const item = students[i];
      let delayApplied = 0;

      if (i > 0) {
        // Natural break every 10 messages: pause for 45-60s
        if (i % 10 === 0 && pacingDelayMs === undefined) {
          const breakDelay = 45000 + Math.floor(Math.random() * 20000);
          logger.info(`[WhatsAppPacing] Parent portal batch break: pausing for ${(breakDelay / 1000).toFixed(0)}s`);
          await new Promise((r) => setTimeout(r, breakDelay));
        }

        delayApplied = pacingDelayMs !== undefined ? pacingDelayMs : (12000 + Math.floor(Math.random() * 18000));
        if (delayApplied > 0) {
          await new Promise((r) => setTimeout(r, delayApplied));
        }
      }

      try {
        const sendRes = await this.sendParentPortalLink({
          tenant_id,
          teacher_id,
          student_id: item.student_id,
          student_name: item.student_name,
          parent_phone: item.parent_phone,
          teacher_name,
          portal_url: item.portal_url,
        });

        if (sendRes.success) {
          sentCount++;
          results.push({
            student_id: item.student_id,
            student_name: item.student_name,
            status: "sent",
            delay_applied_ms: delayApplied,
            message_text: sendRes.message_text,
          });
        } else {
          failedCount++;
          results.push({
            student_id: item.student_id,
            student_name: item.student_name,
            status: "failed",
            error: sendRes.error,
            delay_applied_ms: delayApplied,
          });
        }
      } catch (err: unknown) {
        failedCount++;
        results.push({
          student_id: item.student_id,
          student_name: item.student_name,
          status: "failed",
          error: (err as Error).message,
          delay_applied_ms: delayApplied,
        });
      }
    }

    return {
      total: students.length,
      sent_count: sentCount,
      failed_count: failedCount,
      results,
    };
  }

  /**
   * DEV-NOTIF.1: Batch send notifications (rescheduled, cancelled, extra_session) directly to students with Anti-Ban pacing & spintax.
   */
  async batchSendCustomNotification(
    tenantId: string,
    items: Array<{
      recipient_id: string;
      recipient_name: string;
      phone: string;
      custom_message?: string;
    }>,
    options: {
      event_type: "rescheduled" | "cancelled" | "extra_session" | "general";
      group_name?: string;
      date?: string;
      time?: string;
      reason?: string;
      topic?: string;
      teacher_id?: string | null;
      teacher_name?: string;
      pacingDelayMs?: number;
      dailyCap?: number;
    }
  ): Promise<{
    total: number;
    sent_count: number;
    skipped_count: number;
    failed_count: number;
    daily_quota: {
      sent_today: number;
      daily_limit: number;
      remaining: number;
      cap_reached: boolean;
      approaching_cap: boolean;
      warning?: string;
    };
    results: Array<{
      recipient_id: string;
      recipient_name: string;
      status: "sent" | "failed" | "skipped_daily_cap" | "skipped_circuit_open" | "skipped_no_phone";
      error?: string;
      delay_applied_ms?: number;
      message_text?: string;
    }>;
  }> {
    const dailyCap = options?.dailyCap || DEFAULT_SAFE_DAILY_CAP;
    const results: Array<{
      recipient_id: string;
      recipient_name: string;
      status: "sent" | "failed" | "skipped_daily_cap" | "skipped_circuit_open" | "skipped_no_phone";
      error?: string;
      delay_applied_ms?: number;
      message_text?: string;
    }> = [];

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.phone || item.phone.trim().length < 8) {
        skippedCount += 1;
        results.push({
          recipient_id: item.recipient_id,
          recipient_name: item.recipient_name,
          status: "skipped_no_phone",
          error: "No valid student phone number registered",
        });
        continue;
      }

      // 1. Check Circuit Breaker
      const health = getHealthStatus(tenantId);
      if (!health.can_send) {
        skippedCount += 1;
        results.push({
          recipient_id: item.recipient_id,
          recipient_name: item.recipient_name,
          status: "skipped_circuit_open",
          error: `Circuit breaker is paused until ${health.paused_until || "unknown"}`,
        });
        continue;
      }

      // 2. Check Daily Volume Cap
      const currentQuota = getDailyQuotaStatus(tenantId, dailyCap);
      if (currentQuota.cap_reached) {
        skippedCount += 1;
        results.push({
          recipient_id: item.recipient_id,
          recipient_name: item.recipient_name,
          status: "skipped_daily_cap",
          error: `Daily volume cap of ${dailyCap} reached for tenant. Further sends halted to prevent Meta ban.`,
        });
        continue;
      }

      // 3. Apply Jitter Delay
      let delayApplied = 0;
      if (i > 0) {
        delayApplied =
          options?.pacingDelayMs !== undefined
            ? options.pacingDelayMs
            : calculateJitterDelay();
        if (delayApplied > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayApplied));
        }
      }

      // 4. Generate dynamic message with spintax
      let text = item.custom_message;
      if (!text) {
        const greetings = [
          `السلام عليكم ورحمة الله، عزيزنا الطالب (${item.recipient_name})`,
          `أهلاً بك يا بطل (${item.recipient_name})، تنبيه هام بخصوص الحصة`,
          `تحية طيبة للطالب العزيز (${item.recipient_name})`,
        ];
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];

        if (options.event_type === "rescheduled") {
          text = `${greeting}\n\nنود إبلاغك بتعديل موعد حصة (${options.group_name || "المجموعة"}).\nالموعد الجديد: ${options.date || ""}${options.time ? ` (${options.time})` : ""}.\n${options.reason ? `سبب التعديل: ${options.reason}\n` : ""}يرجى التواجد في الموعد المحدد والالتزام.\n\nمع تحيات: مستر ${options.teacher_name || "المعلم"}`;
        } else if (options.event_type === "cancelled") {
          text = `${greeting}\n\nنحيطك علماً بإلغاء حصة (${options.group_name || "المجموعة"})${options.date ? ` المقررة بتاريخ ${options.date}` : ""}.\n${options.reason ? `السبب: ${options.reason}\n` : ""}سيتم إعلامك بالموعد البديل لاحقاً حرصاً على دراستك.\n\nمع أطيب التمنيات بالتوفيق والنجاح.`;
        } else if (options.event_type === "extra_session") {
          text = `${greeting}\n\nيسعدنا إبلاغك بجدولة حصة إضافية لمجموعة (${options.group_name || "المجموعة"}).\nالموعد: ${options.date || ""}${options.time ? ` (${options.time})` : ""}.\n${options.topic ? `موضوع الحصة: ${options.topic}\n` : ""}يرجى الالتزام بالحضور والاستعداد الجيد.\n\nمع تحيات: مستر ${options.teacher_name || "المعلم"}`;
        } else {
          text = `${greeting}\n\nتنبيه هام بخصوص مجموعة (${options.group_name || "المجموعة"}).\n${options.reason ? `التفاصيل: ${options.reason}\n` : options.topic ? `الموضوع: ${options.topic}\n` : ""}\nمع أطيب التمنيات بالتوفيق والنجاح.`;
        }
      }

      // 5. Send via Gateway through teacher instance with fallback
      let delivered = false;
      if (this.gateway?.sendTextMessage) {
        const actualTeacherId = options.teacher_id || "default";
        const primaryInstance = buildInstanceName(tenantId, actualTeacherId);
        const fallbackInstance = buildInstanceName(tenantId, "default");

        try {
          let gwRes = await this.gateway.sendTextMessage(primaryInstance, item.phone, text);
          if (!gwRes.success && primaryInstance !== fallbackInstance) {
            gwRes = await this.gateway.sendTextMessage(fallbackInstance, item.phone, text);
          }
          const globalInstance = config.evolutionInstanceName;
          if (!gwRes.success && globalInstance && globalInstance !== primaryInstance && globalInstance !== fallbackInstance) {
            gwRes = await this.gateway.sendTextMessage(globalInstance, item.phone, text);
          }
          if (gwRes.success) {
            delivered = true;
            sentCount += 1;
            incrementTenantDailyCount(tenantId, 1);
            recordHealthSuccess(tenantId);
            results.push({
              recipient_id: item.recipient_id,
              recipient_name: item.recipient_name,
              status: "sent",
              delay_applied_ms: delayApplied,
              message_text: text,
            });
          } else {
            failedCount += 1;
            recordHealthError(tenantId, "disconnect");
            results.push({
              recipient_id: item.recipient_id,
              recipient_name: item.recipient_name,
              status: "failed",
              error: gwRes.error || "Gateway send failed",
              delay_applied_ms: delayApplied,
              message_text: text,
            });
          }
        } catch (err: unknown) {
          failedCount += 1;
          recordHealthError(tenantId, "timeout");
          results.push({
            recipient_id: item.recipient_id,
            recipient_name: item.recipient_name,
            status: "failed",
            error: (err as Error).message,
            delay_applied_ms: delayApplied,
            message_text: text,
          });
        }
      } else {
        // Non-gateway / test environment
        sentCount += 1;
        incrementTenantDailyCount(tenantId, 1);
        recordHealthSuccess(tenantId);
        results.push({
          recipient_id: item.recipient_id,
          recipient_name: item.recipient_name,
          status: "sent",
          delay_applied_ms: delayApplied,
          message_text: text,
        });
      }
    }

    return {
      total: items.length,
      sent_count: sentCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      daily_quota: getDailyQuotaStatus(tenantId, dailyCap),
      results,
    };
  }
}

export interface AttendanceMessageOptions {
  student_name: string;
  attended: boolean;
  comment?: string | null;
  homework_status?: string | null;
  teacher_name?: string | null;
}

// Anti-Repetition Rotation Engine for Spintax
interface SpintaxRotationState {
  greetingIdx: number;
  presentBodyIdx: number;
  absentBodyIdx: number;
  homeworkDoneIdx: number;
  homeworkPartialIdx: number;
  homeworkMissingIdx: number;
  notePrefixIdx: number;
  closingIdx: number;
  quizGreetingIdx: number;
  quizBodyIdx: number;
  quizClosingIdx: number;
  studentQuizGreetingIdx: number;
  studentQuizBodyIdx: number;
  studentQuizClosingIdx: number;
}

const spintaxState: SpintaxRotationState = {
  greetingIdx: -1,
  presentBodyIdx: -1,
  absentBodyIdx: -1,
  homeworkDoneIdx: -1,
  homeworkPartialIdx: -1,
  homeworkMissingIdx: -1,
  notePrefixIdx: -1,
  closingIdx: -1,
  quizGreetingIdx: -1,
  quizBodyIdx: -1,
  quizClosingIdx: -1,
  studentQuizGreetingIdx: -1,
  studentQuizBodyIdx: -1,
  studentQuizClosingIdx: -1,
};

function getRotatedIndex(arrayLength: number, lastIdx: number): number {
  if (arrayLength <= 1) return 0;
  let nextIdx = Math.floor(Math.random() * arrayLength);
  if (nextIdx === lastIdx) {
    nextIdx = (nextIdx + 1 + Math.floor(Math.random() * (arrayLength - 1))) % arrayLength;
  }
  return nextIdx;
}

/**
 * Dynamic Attendance message generator with Anti-Ban Spintax & Phrase Variations.
 * Prevents Meta broadcast spam detection by rotating greetings, presence/absence phrasing, homework, notes, and closings.
 */
export function generateAttendanceMessage(options: AttendanceMessageOptions): string {
  const { student_name, attended, comment, homework_status, teacher_name } = options;

  const greetings = [
    `السلام عليكم ورحمة الله وبركاته، تحية طيبة لولي أمر الطالب/ة (${student_name}).`,
    `تحية طيبة وبعد، ولي أمر الطالب/ة العزيز (${student_name}).`,
    `أهلاً بحضرتك، ولي أمر الطالب/ة (${student_name}) الكرام.`,
    `السلام عليكم، إفادة دورية من إدارة المتابعة لولي أمر الطالب/ة (${student_name}).`,
    `أسعد الله أوقاتكم بكل خير، ولي أمر الطالب/ة (${student_name}).`,
    `تحية تقدير واعتزاز لولي أمر الطالب/ة (${student_name}).`,
    `السلام عليكم ورحمة الله، تقرير المتابعة الخاص بالطالب/ة (${student_name}).`,
    `مرحباً بحضرتك، إشعار الحصة الخاص بنجلكم/نجلتكم (${student_name}).`,
  ];

  const presentBodies = [
    `نفيدكم بحضور الطالب اليوم لحصة المادة بنجاح والالتزام بالحضور.`,
    `نحيط سيادتكم علماً بأن الطالب قد حضر حصة اليوم وتفاعل مع المعلم بنجاح.`,
    `تم بحمد الله تسجيل حضور الطالب اليوم لحصة المادة ونتمنى له دوام الاستفادة والتفوق.`,
    `حضر الطالب حصة اليوم وكان ملتزماً بالموعد ومتابعاً للشرح بكل تركيز.`,
    `نود إعلامكم بتواجد الطالب في حصة اليوم ومشاركته الفعالة مع المعلم.`,
    `سجل الطالب حضوره لحصة اليوم باهتمام وانضباط مشكور عليه.`,
    `يسعدنا إبلاغكم بحضور الطالب اليوم واستفادته من شرح موضوع الحصة كاملاً.`,
    `حرص الطالب اليوم على الحضور في الموعد المحدد ومتابعة تفاصيل الدرس باجتهاد.`,
  ];

  const absentBodies = [
    `نود إحاطة سيادتكم بغياب الطالب/ة عن حضور حصة اليوم. يرجى المتابعة والاطمئنان حرصاً على مستواه الدراسي.`,
    `نلفت عناية حضراتكم إلى تغيب الطالب/ة عن حصة اليوم. نرجو التواصل للاطمئنان عليه وتدارك ما فاته.`,
    `تغيب الطالب/ة عن حضور موعد حصة اليوم، وحرصاً منا على مستواه الدراسي نرجو المتابعة المستمرة.`,
    `يؤسفنا إبلاغكم بتسجيل غياب الطالب/ة عن حصة اليوم وعدم الحضور. برجاء التأكيد والتواصل معنا لمعرفة موعد التعويض.`,
    `إشعار غياب: لم يحضر الطالب/ة حصة اليوم المقررة (غياب). نرجو منكم متابعته والتأكد من تدارك الدرس.`,
    `نحيطكم علماً بغياب الطالب/ة عن حصة اليوم. نأمل الاطمئنان عليه وحثه على عدم تفويت الحصص.`,
    `حرصاً على مصلحة الطالب/ة التعليمية، نود إخطاركم بتغيبه عن حصة اليوم، ونرجو التواصل للتنسيق.`,
    `سجل الطالب/ة غياباً في حصة اليوم، برجاء المتابعة حرصاً على عدم تراكم المنهج والمقررات عليه.`,
  ];

  const homeworkDonePhrases = [
    `الواجب المنزلي: مكتمل وممتاز وتم حله بعناية.`,
    `متابعة الواجب: مكتمل وممتاز والحل نموذجي.`,
    `حالة الواجب: مكتمل وممتاز، تم تسليمه والالتزام بالحل.`,
    `أداء الواجب: مكتمل وممتاز وأداء مبشر يستحق التشجيع.`,
    `تقرير الواجب: مكتمل وممتاز ومحلول بالكامل.`,
  ];

  const homeworkPartialPhrases = [
    `حالة الواجب: ناقص، يرجى حث الطالب على استكماله.`,
    `متابعة الواجب المنزلي: تم إنجاز جزء فقط من الواجب ويحتاج لاستكمال.`,
    `الواجب: غير مكتمل، يرجى التنبيه عليه بضرورة إنهائه كاملاً.`,
    `أداء الواجب: ناقص، نرجو المتابعة لحل باقي التمارين قبل الحصة القادمة.`,
    `تقرير الواجب: منجز جزئياً فقط، ونرجو المتابعة المنزلية لاستكماله.`,
  ];

  const homeworkMissingPhrases = [
    `حالة الواجب: لم يتم تسليم الواجب اليوم.`,
    `متابعة الواجب المنزلي: لم يقم الطالب بإحضار أو تسليم الواجب.`,
    `الواجب: لم يتم حله، نرجو المتابعة الجادة والتأكيد على الالتزام.`,
    `أداء الواجب: لم يتم تسليمه في الحصة، برجاء تعويضه فوراً.`,
    `تقرير الواجب: لم يُسلّم اليوم، حرصاً على مستواه نرجو المتابعة المنزلية.`,
  ];

  const notePrefixes = [
    "ملاحظة المعلم: ",
    "توجيه خاص من المعلم: ",
    "إفادة المعلم حول مستوى الطالب: ",
    "ملاحظة خاصة من الحصة: ",
    "تقرير الأداء من المعلم: ",
  ];

  const closings = [
    "شاكرين حسن تعاونكم وحرصكم المستمر.",
    "مع أطيب تمنياتنا للطالب بالتوفيق والنجاح الدائم.",
    "شاكرين ومقدرين متابعتكم الكريمة واهتمامكم.",
    "دمتم ودام أبناؤكم في تفوق ونجاح مستمر.",
    "مع خالص تحياتنا وتمنياتنا بدوام التميز والتفوق.",
    "خالص الشكر والتقدير لتعاونكم المثمر دائماً.",
    "نسأل الله له التوفيق والسداد في مسيرته الدراسية.",
    "مع تحيات إدارة المتابعة والتعليم.",
  ];

  // Rotate greeting
  spintaxState.greetingIdx = getRotatedIndex(greetings.length, spintaxState.greetingIdx);
  const greeting = greetings[spintaxState.greetingIdx];

  // Rotate body
  let body = "";
  if (attended) {
    spintaxState.presentBodyIdx = getRotatedIndex(presentBodies.length, spintaxState.presentBodyIdx);
    body = presentBodies[spintaxState.presentBodyIdx];
  } else {
    spintaxState.absentBodyIdx = getRotatedIndex(absentBodies.length, spintaxState.absentBodyIdx);
    body = absentBodies[spintaxState.absentBodyIdx];
  }

  // Rotate homework phrasing (only when student attended and homework status is provided)
  let hwPhrase = "";
  if (attended && homework_status) {
    if (homework_status === "done") {
      spintaxState.homeworkDoneIdx = getRotatedIndex(homeworkDonePhrases.length, spintaxState.homeworkDoneIdx);
      hwPhrase = homeworkDonePhrases[spintaxState.homeworkDoneIdx];
    } else if (homework_status === "partial") {
      spintaxState.homeworkPartialIdx = getRotatedIndex(homeworkPartialPhrases.length, spintaxState.homeworkPartialIdx);
      hwPhrase = homeworkPartialPhrases[spintaxState.homeworkPartialIdx];
    } else if (homework_status === "missing") {
      spintaxState.homeworkMissingIdx = getRotatedIndex(homeworkMissingPhrases.length, spintaxState.homeworkMissingIdx);
      hwPhrase = homeworkMissingPhrases[spintaxState.homeworkMissingIdx];
    }
  }

  let closingOrTeacher = "";
  if (teacher_name && teacher_name.trim()) {
    const tName = teacher_name.trim();
    const formattedTeacher = tName.startsWith("مستر") ? tName : `مستر ${tName}`;
    closingOrTeacher = `مع تحيات: ${formattedTeacher}`;
  } else {
    spintaxState.closingIdx = getRotatedIndex(closings.length, spintaxState.closingIdx);
    closingOrTeacher = closings[spintaxState.closingIdx];
  }

  let message = `${greeting}\n\n${body}`;
  if (hwPhrase) {
    message += `\n${hwPhrase}`;
  }

  // Rotate note prefix if comment exists
  if (comment && comment.trim() && comment.trim() !== "حصة تعويضية") {
    spintaxState.notePrefixIdx = getRotatedIndex(notePrefixes.length, spintaxState.notePrefixIdx);
    const prefix = notePrefixes[spintaxState.notePrefixIdx];
    message += `\n${prefix}${comment.trim()}`;
  }

  message += `\n\n${closingOrTeacher}`;

  return message;
}

export interface QuizMessageOptions {
  student_name: string;
  quiz_title: string;
  score: number;
  max_score?: number;
  teacher_name?: string;
  note?: string;
  recipient_type?: "parent" | "student";
}

/**
 * DEV-QUIZ.3: Dynamic message generator with Anti-Ban Spintax & Phrase Variations.
 * Supports both parent-facing and student-facing phrasing.
 * Prevents Meta broadcast spam detection by varying greetings, appraisal tone, and closings.
 */
export function generateQuizScoreMessage(options: QuizMessageOptions): string {
  const { student_name, quiz_title, score, max_score = 10, teacher_name, note, recipient_type = "parent" } = options;
  const percentage = (score / max_score) * 100;
  const displayTitle = quiz_title && quiz_title.trim() ? quiz_title.trim() : "كويز";
  const ratingText = percentage >= 85 ? "ممتاز" : percentage >= 65 ? "جيد" : "يحتاج متابعة";

  if (recipient_type === "student") {
    const studentGreetings = [
      `السلام عليكم ورحمة الله وبركاته، عزيزنا الطالب (${student_name}).`,
      `أهلاً بك يا (${student_name})، نتمنى لك دوام التوفيق والنجاح.`,
      `تحية طيبة عزيزنا الطالب (${student_name}).`,
      `السلام عليكم يا (${student_name})، نتيجة تقييمك في الاختبار:`,
      `مرحباً يا (${student_name})، إليك نتيجتك في تقييم اليوم:`,
      `أسعد الله أوقاتك بكل خير يا (${student_name})، تقرير درجاتك:`,
      `السلام عليكم ورحمة الله، درجات اختبارك الأخير يا (${student_name}):`,
    ];

    const studentExcellentPhrases = [
      `نبارك لك تميزك وتفوقك في (${displayTitle}) وحصولك على درجة ممتازة: (${score} من ${max_score}). استمر على هذا الأداء الرائع!`,
      `ما شاء الله، أداء متألق ومتميز في (${displayTitle}) بدرجة (${score} من ${max_score}). فخورون باجتهادك ونتمنى لك دوام التفوق.`,
      `أحسنت يا بطل! حققت درجة مشرفة في (${displayTitle}): (${score} من ${max_score}). حافظ على هذا المستوى المتميز دائماً.`,
      `أداء استثنائي وعلامة ممتازة في (${displayTitle}): (${score} من ${max_score}). استمر في الاجتهاد وننتظر منك الأفضل دائماً.`,
    ];

    const studentGoodPhrases = [
      `أحسنت، درجتك في (${displayTitle}) هي (${score} من ${max_score}). بداية طيبة، وبمزيد من التركيز والمراجعة ستصل للدرجة النهائية بإذن الله.`,
      `حققت في (${displayTitle}) درجة (${score} من ${max_score}). مستوى جيد، ركّز على النقاط التي أخطأت بها لتعويضها في الاختبار القادم.`,
      `نتيجتك في (${displayTitle}) هي (${score} من ${max_score}). أداء طيب ونثق بقدرتك على تحقيق أعلى الدرجات بالمثابرة والمذاكرة الجادة.`,
      `أحرزت (${score} من ${max_score}) في (${displayTitle}). مستوى طيب، شد حيلك ونريد منك الدرجة النهائية في المرة القادمة إن شاء الله.`,
    ];

    const studentNeedAttentionPhrases = [
      `درجتك في (${displayTitle}) هي (${score} من ${max_score}). لا تقلق، راجع أخطاءك جيداً وركّز في الحصص القادمة للتعويض ورفع مستواك.`,
      `حصلت على درجة (${score} من ${max_score}) في (${displayTitle}). تحتاج لمزيد من المذاكرة والاهتمام بحل التمارين لتدارك هذا المستوى سريعاً.`,
      `نتيجتك في (${displayTitle}) هي (${score} من ${max_score}). ننتظر منك مجهوداً أكبر وتركيزاً أعلى في المذاكرة، وأنت قادر على التعويض بإذن الله.`,
      `أظهر اختبار (${displayTitle}) حصولك على (${score} من ${max_score}). لا تستسلم، راجع الدروس واطلب المساعدة في أي نقطة غير واضحة للتعويض.`,
    ];

    const studentClosings = [
      "مع تمنياتنا لك بالتوفيق والنجاح الدائم.",
      "دائماً في رفعة وتفوق مستمر إن شاء الله.",
      "مع أطيب تمنياتنا لك بدوام التميز والإنجاز.",
      "نثق بقدراتك، بالتوفيق والنجاح الدائم.",
      "مع خالص أمنياتنا لك بمستقبل مشرق ومتميز.",
    ];

    spintaxState.studentQuizGreetingIdx = getRotatedIndex(studentGreetings.length, spintaxState.studentQuizGreetingIdx);
    const greeting = studentGreetings[spintaxState.studentQuizGreetingIdx];

    let body = "";
    if (percentage >= 85) {
      spintaxState.studentQuizBodyIdx = getRotatedIndex(studentExcellentPhrases.length, spintaxState.studentQuizBodyIdx);
      body = studentExcellentPhrases[spintaxState.studentQuizBodyIdx];
    } else if (percentage >= 65) {
      spintaxState.studentQuizBodyIdx = getRotatedIndex(studentGoodPhrases.length, spintaxState.studentQuizBodyIdx);
      body = studentGoodPhrases[spintaxState.studentQuizBodyIdx];
    } else {
      spintaxState.studentQuizBodyIdx = getRotatedIndex(studentNeedAttentionPhrases.length, spintaxState.studentQuizBodyIdx);
      body = studentNeedAttentionPhrases[spintaxState.studentQuizBodyIdx];
    }

    let teacherLine = "";
    if (teacher_name && teacher_name.trim()) {
      const tName = teacher_name.trim();
      const formattedTeacher = tName.startsWith("مستر") || tName.startsWith("أ.") || tName.startsWith("أستاذ") ? tName : `مستر ${tName}`;
      teacherLine = `مع تحيات: ${formattedTeacher}`;
    } else {
      spintaxState.studentQuizClosingIdx = getRotatedIndex(studentClosings.length, spintaxState.studentQuizClosingIdx);
      teacherLine = studentClosings[spintaxState.studentQuizClosingIdx];
    }

    let message = `${greeting}\n\nنتيجة اختبار: ${displayTitle}\nدرجتك: *${score} من ${max_score}* (${ratingText})\n\n${body}`;

    if (note && note.trim()) {
      message += `\nملاحظة المعلم: ${note.trim()}`;
    }

    message += `\n\n${teacherLine}`;
    return message;
  }

  const greetings = [
    `السلام عليكم ورحمة الله وبركاته، تحية طيبة لولي أمر الطالب/ة (${student_name}).`,
    `تحية طيبة وبعد، ولي أمر الطالب/ة العزيز (${student_name}).`,
    `أهلاً بحضرتك ولي أمر الطالب/ة (${student_name})، ونتمنى لكم دوام التوفيق.`,
    `السلام عليكم، نود إحاطة سيادتكم علماً بنتيجة الطالب/ة (${student_name}).`,
    `تحية تقدير واعتزاز لولي أمر الطالب/ة (${student_name}).`,
    `أسعد الله أوقاتكم بكل خير، إفادة بنتائج تقييم الطالب/ة (${student_name}).`,
    `السلام عليكم ورحمة الله، تقرير الاختبار الخاص بالطالب/ة (${student_name}).`,
    `مرحباً بحضرتك، نود مشاركتكم نتيجة التقييم لنجلكم/نجلتكم (${student_name}).`,
  ];

  const excellentPhrases = [
    `نبارك لكم تميز وتفوق الطالب في (${displayTitle}) وحصوله على درجة ممتازة: (${score} من ${max_score}).`,
    `يسعدنا إبلاغكم بنتيجة الطالب الرائعة في (${displayTitle}): حيث حقق (${score} من ${max_score})، وهو أداء ممتاز ومشرف.`,
    `ما شاء الله، أداء متألق في (${displayTitle}) بدرجة (${score} من ${max_score})، ونتمنى له دوام التميز والتفوق.`,
    `أداء استثنائي وعلامة مشرفة في (${displayTitle}) بدرجة (${score} من ${max_score})، ومستوى يستحق التقدير والتشجيع.`,
  ];

  const goodPhrases = [
    `نفيدكم بنتيجة الطالب في (${displayTitle}) حيث حصل على (${score} من ${max_score})، وهو أداء جيد ونتطلع لمزيد من التقدم بإذن الله.`,
    `حقق الطالب في (${displayTitle}) درجة (${score} من ${max_score}). مستوى طيب ومبشر، وبمزيد من التركيز والاجتهاد سيصل لأعلى الدرجات.`,
    `نحيطكم علماً بأن درجة الطالب في (${displayTitle}) هي (${score} من ${max_score}). بداية جيدة ونشجعه على الاستمرار.`,
    `أحرز الطالب (${score} من ${max_score}) في (${displayTitle}). مستوى طيب ومبشر ونتوقع منه الأفضل دوماً.`,
  ];

  const needAttentionPhrases = [
    `نحيطكم علماً بنتيجة الطالب في (${displayTitle}): حيث حصل على (${score} من ${max_score}). برجاء حثه على المذاكرة والمتابعة المستمرة لتحسين مستواه في الاختبارات القادمة.`,
    `سجل الطالب درجة (${score} من ${max_score}) في (${displayTitle}). نرجو تكثيف المتابعة المنزلية والمراجعة لتدارك النقاط الصعبة أولاً بأول.`,
    `حصل الطالب على درجة (${score} من ${max_score}) في (${displayTitle}). نحثكم على تشجيعه لتعويض ذلك والتركيز خلال الحصص القادمة.`,
    `أظهر تقييم (${displayTitle}) حصول الطالب على (${score} من ${max_score}). نرجو التعاون وحثه على المراجعة الجادة لرفع مستواه في الاختبار القادم.`,
  ];

  const closings = [
    "شاكرين حسن تعاونكم وحرصكم المستمر.",
    "مع أطيب تمنياتنا بالتوفيق والنجاح الدائم.",
    "شاكرين ومقدرين متابعتكم الكريمة واهتمامكم.",
    "دمتم ودام أبناؤكم في رفعة وتفوق مستمر.",
    "مع خالص تحياتنا وتمنياتنا بدوام التميز.",
    "شاكرين لكم حرصكم ومتابعتكم الدائمة.",
  ];

  // Rotate greeting
  spintaxState.quizGreetingIdx = getRotatedIndex(greetings.length, spintaxState.quizGreetingIdx);
  const greeting = greetings[spintaxState.quizGreetingIdx];

  // Rotate body based on tier
  let body = "";
  if (percentage >= 85) {
    spintaxState.quizBodyIdx = getRotatedIndex(excellentPhrases.length, spintaxState.quizBodyIdx);
    body = excellentPhrases[spintaxState.quizBodyIdx];
  } else if (percentage >= 65) {
    spintaxState.quizBodyIdx = getRotatedIndex(goodPhrases.length, spintaxState.quizBodyIdx);
    body = goodPhrases[spintaxState.quizBodyIdx];
  } else {
    spintaxState.quizBodyIdx = getRotatedIndex(needAttentionPhrases.length, spintaxState.quizBodyIdx);
    body = needAttentionPhrases[spintaxState.quizBodyIdx];
  }

  let teacherLine = "";
  if (teacher_name && teacher_name.trim()) {
    const tName = teacher_name.trim();
    const formattedTeacher = tName.startsWith("مستر") || tName.startsWith("أ.") || tName.startsWith("أستاذ") ? tName : `مستر ${tName}`;
    teacherLine = `مع تحيات: ${formattedTeacher}`;
  } else {
    spintaxState.quizClosingIdx = getRotatedIndex(closings.length, spintaxState.quizClosingIdx);
    teacherLine = closings[spintaxState.quizClosingIdx];
  }

  let message = `${greeting}\n\nنتيجة اختبار: ${displayTitle}\nالدرجة: *${score} من ${max_score}* (${ratingText})\n\n${body}`;

  if (note && note.trim()) {
    message += `\nملاحظة المعلم: ${note.trim()}`;
  }

  message += `\n\n${teacherLine}`;

  return message;
}

/**
 * DEV-PORTAL.3: Generates warm, respectful, anti-ban spintax invite message for parent tracking portal.
 */
export function generateParentPortalInviteMessage(params: {
  student_name: string;
  teacher_name?: string;
  portal_url: string;
}): string {
  const student = (params.student_name || "").trim() || "الطالب";
  const rawTeacher = (params.teacher_name || "").trim() || "إدارة المتابعة";
  const teacher = rawTeacher.startsWith("مستر") || rawTeacher.startsWith("أ.") || rawTeacher.startsWith("أستاذ")
    ? rawTeacher
    : `مستر ${rawTeacher}`;
  const url = params.portal_url;

  const greetings = [
    `السلام عليكم ورحمة الله وبركاته، ولي أمر الطالب (${student}).`,
    `تحياتنا الطيبة لولي أمر الطالب (${student})، السلام عليكم ورحمة الله وبركاته.`,
    `السلام عليكم ورحمة الله، أهلاً بحضرتك ولي أمر الطالب (${student}).`,
    `تحية تربوية كريمة لولي أمر الطالب (${student})، السلام عليكم ورحمة الله.`,
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  const intros = [
    `حرصاً على متابعة المستوى الدراسي لـ (${student}) أولاً بأول، يسعدنا تزويدكم برابط بوابة المتابعة المباشرة الخاصة به:`,
    `لمتابعة مستوى وتفوق نجلكم (${student}) بصفة مستمرة، إليكم رابط المتابعة الإلكتروني الخاص به:`,
    `تيسيراً على حضراتكم في متابعة أداء الطالب (${student})، نقدم لكم الرابط المباشر لملف المتابعة الخاص به:`,
    `في إطار حرصنا على الشفافية والتواصل الدائم، نرفق لحضراتكم رابط المتابعة الأكاديمية الخاص بـ (${student}):`,
  ];
  const intro = intros[Math.floor(Math.random() * intros.length)];

  const closings = [
    `مع خالص تمنياتنا للطالب (${student}) بدوام التفوق والنجاح.\nمع تحيات: ${teacher}`,
    `نسأل الله له كامل التوفيق والتميز دائماً.\nمع تحيات: ${teacher}`,
    `شاكرين لحضراتكم حسن المتابعة والاهتمام.\nمع تحيات: ${teacher}`,
    `مع أطيب التمنيات بمستقبل مشرق ومتميز.\nمع تحيات: ${teacher}`,
  ];
  const closing = closings[Math.floor(Math.random() * closings.length)];

  return `${greeting}

${intro}

🔗 *رابط المتابعة المباشر:*
${url}

💡 *من خلال هذا الرابط يمكنكم في أي وقت وبدون تسجيل دخول:*
• متابعة تسجيل الحضور والغياب لحظياً مع كل حصة.
• الاطلاع على درجات الكويزات والامتحانات الدورية فور رصدها.
• متابعة الالتزام بتسليم وحل الواجبات المنزلية.
• قراءة ملاحظات وتوجيهات المعلم المباشرة.

${closing}`;
}

// Daily Volume Tracking (DEV-36)
interface DailyQuotaRecord {
  date: string;
  sent_count: number;
}
const tenantDailyQuotaMap = new Map<string, DailyQuotaRecord>();
export const DEFAULT_SAFE_DAILY_CAP = 500;
const WARNING_THRESHOLD_PERCENT = 0.8; // 80% = 400 messages

export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export function getTenantDailyCount(tenantId: string): number {
  const today = getTodayDateString();
  const record = tenantDailyQuotaMap.get(tenantId);
  if (!record || record.date !== today) {
    return 0;
  }
  return record.sent_count;
}

export function incrementTenantDailyCount(tenantId: string, count = 1): number {
  const today = getTodayDateString();
  let record = tenantDailyQuotaMap.get(tenantId);
  if (!record || record.date !== today) {
    record = { date: today, sent_count: 0 };
    tenantDailyQuotaMap.set(tenantId, record);
  }
  record.sent_count += count;
  return record.sent_count;
}

export function resetTenantDailyCount(tenantId: string): void {
  tenantDailyQuotaMap.delete(tenantId);
}

export function getDailyQuotaStatus(tenantId: string, dailyCap = DEFAULT_SAFE_DAILY_CAP) {
  const sentToday = getTenantDailyCount(tenantId);
  const remaining = Math.max(0, dailyCap - sentToday);
  const isCapReached = sentToday >= dailyCap;
  const isApproachingCap = sentToday >= dailyCap * WARNING_THRESHOLD_PERCENT;

  return {
    sent_today: sentToday,
    daily_limit: dailyCap,
    remaining,
    cap_reached: isCapReached,
    approaching_cap: isApproachingCap,
    warning: isApproachingCap
      ? `تنبيه: اقترب حسابك من الحد اليومي الآمن (${sentToday}/${dailyCap} رسالة اليوم). يُنصح بجدولة الإرسال لتجنب حظر الرقم من واتساب.`
      : undefined,
  };
}
