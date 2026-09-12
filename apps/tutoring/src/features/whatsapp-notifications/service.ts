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
  async sendQuizScore(params: {
    tenant_id: string;
    teacher_id?: string | null;
    student_id: string;
    student_name: string;
    parent_phone: string;
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
  }> {
    const {
      tenant_id,
      teacher_id,
      student_id,
      student_name,
      parent_phone,
      quiz_title,
      score,
      max_score = 10,
      teacher_name,
      note,
      custom_message,
    } = params;

    const messageText =
      custom_message ||
      generateQuizScoreMessage({
        student_name,
        quiz_title,
        score,
        max_score,
        teacher_name,
        note,
      });

    // 1. Check Circuit Breaker
    const health = getHealthStatus(tenant_id);
    if (!health.can_send) {
      return {
        success: false,
        error: `Circuit breaker is paused until ${health.paused_until || "unknown"}`,
        message_text: messageText,
        recipient: parent_phone,
        gateway_sent: false,
      };
    }

    // 2. Check Daily Volume Cap
    const currentQuota = getDailyQuotaStatus(tenant_id);
    if (currentQuota.cap_reached) {
      return {
        success: false,
        error: `Daily volume cap reached for tenant. Sending paused to prevent ban.`,
        message_text: messageText,
        recipient: parent_phone,
        gateway_sent: false,
      };
    }

    // 3. Dispatch via Gateway using teacher instance with fallback
    let gatewaySent = false;
    if (this.gateway?.sendTextMessage && parent_phone) {
      const actualTeacherId = teacher_id || "default";
      const primaryInstance = buildInstanceName(tenant_id, actualTeacherId);
      const fallbackInstance = buildInstanceName(tenant_id, "default");

      try {
        if (this.gateway.sendPresence) {
          await this.gateway.sendPresence(primaryInstance, parent_phone, "composing").catch(() => {});
          if (process.env.NODE_ENV !== "test") {
            const typingDuration = 2000 + Math.floor(Math.random() * 1500);
            await new Promise((r) => setTimeout(r, typingDuration));
          }
        }

        let gwRes = await this.gateway.sendTextMessage(primaryInstance, parent_phone, messageText);
        if (!gwRes.success && primaryInstance !== fallbackInstance) {
          logger.info(
            `[WhatsAppService] Retrying sendQuizScore with fallback instance ${fallbackInstance}`
          );
          gwRes = await this.gateway.sendTextMessage(fallbackInstance, parent_phone, messageText);
        }
        const globalInstance = config.evolutionInstanceName;
        if (!gwRes.success && globalInstance && globalInstance !== primaryInstance && globalInstance !== fallbackInstance) {
          logger.info(`[WhatsAppService] Retrying sendQuizScore with global instance ${globalInstance}`);
          gwRes = await this.gateway.sendTextMessage(globalInstance, parent_phone, messageText);
        }

        if (gwRes.success) {
          gatewaySent = true;
          incrementTenantDailyCount(tenant_id, 1);
          recordHealthSuccess(tenant_id);
        } else {
          recordHealthError(tenant_id, "disconnect");
          return {
            success: false,
            error: gwRes.error || "Evolution gateway failed to send text message",
            message_text: messageText,
            recipient: parent_phone,
            gateway_sent: false,
          };
        }
      } catch (gwErr) {
        recordHealthError(tenant_id, "timeout");
        return {
          success: false,
          error: (gwErr as Error).message,
          message_text: messageText,
          recipient: parent_phone,
          gateway_sent: false,
        };
      }
    } else {
      // In test or non-gateway environment
      gatewaySent = true;
      incrementTenantDailyCount(tenant_id, 1);
      recordHealthSuccess(tenant_id);
    }

    return {
      success: true,
      message_text: messageText,
      recipient: parent_phone,
      gateway_sent: gatewaySent,
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
        const sendRes = await this.sendQuizScore({
          tenant_id: tenantId,
          teacher_id: options.teacher_id,
          student_id: item.student_id,
          student_name: item.student_name,
          parent_phone: item.parent_phone,
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
          text = `${greeting}\nنود إبلاغك بتعديل موعد حصة (${options.group_name || "المجموعة"}).\n📅 الموعد الجديد: ${options.date || ""}${options.time ? ` (${options.time})` : ""}.\n${options.reason ? `سبب التعديل: ${options.reason}\n` : ""}نرجو التواجد في الموعد المحدد.\nمع تحيات: مستر ${options.teacher_name || "المعلم"}`;
        } else if (options.event_type === "cancelled") {
          text = `${greeting}\nنحيطك علماً بإلغاء حصة (${options.group_name || "المجموعة"})${options.date ? ` المقررة بتاريخ ${options.date}` : ""}.\n${options.reason ? `السبب: ${options.reason}\n` : ""}سيتم إعلامك بالموعد البديل لاحقاً حرصاً على دراستك.\nمع تمنياتنا بالتوفيق.`;
        } else if (options.event_type === "extra_session") {
          text = `${greeting}\nيسعدنا إبلاغك بجدولة حصة إضافية لمجموعة (${options.group_name || "المجموعة"}).\n📅 الموعد: ${options.date || ""}${options.time ? ` (${options.time})` : ""}.\n${options.topic ? `موضوع الحصة: ${options.topic}\n` : ""}يرجى الالتزام بالحضور والاستعداد الجيد.\nمع تحيات: مستر ${options.teacher_name || "المعلم"}`;
        } else {
          text = `${greeting}\nتنبيه هام بخصوص مجموعة (${options.group_name || "المجموعة"}).\n${options.reason || options.topic || ""}\nمع أطيب التمنيات.`;
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
    `\nحالة الواجب: مكتمل وممتاز 👍`,
    `\nمتابعة الواجب المنزلي: مكتمل وممتاز وتم أداؤه بعناية 🌟`,
    `\nالواجب: مكتمل وممتاز، تم تسليمه والالتزام بالحل النموذجي ✔️`,
    `\nحالة الواجب: مكتمل وممتاز وأداء مبشر يستحق التشجيع 👏`,
    `\nتقرير الواجب: مكتمل وممتاز ومحلول بالكامل 💯`,
  ];

  const homeworkPartialPhrases = [
    `\nحالة الواجب: ناقص ويحتاج إلى استكمال ⚠️`,
    `\nمتابعة الواجب المنزلي: تم إنجاز جزء فقط من الواجب ويحتاج لاستكمال 📝`,
    `\nالواجب: غير مكتمل، يرجى التنبيه بضرورة إنهائه كاملاً ⚠️`,
    `\nحالة الواجب: ناقص، نرجو حثه على استكمال باقي التمارين قبل الحصة القادمة ⏳`,
    `\nتقرير الواجب: منجز جزئياً فقط، ونرجو المتابعة المنزلية لاستكماله 📌`,
  ];

  const homeworkMissingPhrases = [
    `\nحالة الواجب: لم يتم تسليم الواجب ❌`,
    `\nمتابعة الواجب المنزلي: لم يقم الطالب بإحضار أو تسليم الواجب ⚠️`,
    `\nالواجب: لم يتم حله، نرجو المتابعة الجادة والتأكيد على الالتزام ❌`,
    `\nحالة الواجب: لم يتم تسليمه في الحصة، يرجى التنبيه عليه بالتعويض فوراً 📌`,
    `\nتقرير الواجب: لم يُسلّم اليوم، حرصاً على مستواه نرجو المتابعة المنزلية ❌`,
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

  let message = `${greeting}\n${body}`;

  // Rotate homework phrasing
  if (homework_status === "done") {
    spintaxState.homeworkDoneIdx = getRotatedIndex(homeworkDonePhrases.length, spintaxState.homeworkDoneIdx);
    message += homeworkDonePhrases[spintaxState.homeworkDoneIdx];
  } else if (homework_status === "partial") {
    spintaxState.homeworkPartialIdx = getRotatedIndex(homeworkPartialPhrases.length, spintaxState.homeworkPartialIdx);
    message += homeworkPartialPhrases[spintaxState.homeworkPartialIdx];
  } else if (homework_status === "missing") {
    spintaxState.homeworkMissingIdx = getRotatedIndex(homeworkMissingPhrases.length, spintaxState.homeworkMissingIdx);
    message += homeworkMissingPhrases[spintaxState.homeworkMissingIdx];
  }

  // Rotate note prefix if comment exists
  if (comment && comment.trim() && comment.trim() !== "حصة تعويضية") {
    spintaxState.notePrefixIdx = getRotatedIndex(notePrefixes.length, spintaxState.notePrefixIdx);
    const prefix = notePrefixes[spintaxState.notePrefixIdx];
    message += `\n${prefix}${comment.trim()}`;
  }

  if (teacher_name && teacher_name.trim()) {
    message += `\nمع تحيات: مستر ${teacher_name.trim()}`;
  } else {
    spintaxState.closingIdx = getRotatedIndex(closings.length, spintaxState.closingIdx);
    message += `\n${closings[spintaxState.closingIdx]}`;
  }

  return message;
}

export interface QuizMessageOptions {
  student_name: string;
  quiz_title: string;
  score: number;
  max_score?: number;
  teacher_name?: string;
  note?: string;
}

/**
 * DEV-QUIZ.3: Dynamic message generator with Anti-Ban Spintax & Phrase Variations.
 * Prevents Meta broadcast spam detection by varying greetings, appraisal tone, and closings.
 */
export function generateQuizScoreMessage(options: QuizMessageOptions): string {
  const { student_name, quiz_title, score, max_score = 10, teacher_name, note } = options;
  const percentage = (score / max_score) * 100;

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
    `نبارك لكم تميز وتفوق الطالب في (${quiz_title}) وحصوله على درجة ممتازة: (${score} من ${max_score}) 🌟.`,
    `يسعدنا إبلاغكم بنتيجة الطالب الرائعة في (${quiz_title}): حيث حقق (${score} من ${max_score})، أداء ممتاز ومشرف!`,
    `ما شاء الله، أداء متألق في (${quiz_title}) بدرجة (${score} من ${max_score}). نرجو له دوام التميز والتفوق.`,
    `أداء استثنائي وعلامة مشرفة في (${quiz_title}) بدرجة (${score} من ${max_score})، نتمنى له استمرار الصدارة 👏.`,
  ];

  const goodPhrases = [
    `نفيدكم بنتيجة الطالب في (${quiz_title}) حصل على (${score} من ${max_score})، وهو أداء جيد ونتطلع لمزيد من التقدم.`,
    `حقق الطالب في (${quiz_title}) درجة (${score} من ${max_score}). مستوى جيد وبمزيد من التركيز والاجتهاد سيصل للقمة بإذن الله.`,
    `نحيطكم علماً بأن درجة الطالب في (${quiz_title}) هي (${score} من ${max_score}). بداية جيدة ونشجعه على الاستمرار.`,
    `أحرز الطالب (${score} من ${max_score}) في (${quiz_title}). مستوى طيب ومبشر ونتوقع منه الأفضل دوماً 👍.`,
  ];

  const needAttentionPhrases = [
    `نحيطكم علماً بنتيجة الطالب في (${quiz_title}): حيث حصل على (${score} من ${max_score}). برجاء حثه على المذاكرة والمتابعة المستمرة لتحسين مستواه في الاختبارات القادمة.`,
    `سجل الطالب درجة (${score} من ${max_score}) في (${quiz_title}). نرجو تكثيف المتابعة المنزلية والمراجعة لتدارك النقاط الصعبة أولاً بأول.`,
    `حصل الطالب على درجة (${score} من ${max_score}) في (${quiz_title}). نحثكم على تشجيعه لتعويض ذلك والتركيز خلال الحصص القادمة.`,
    `أظهر تقييم (${quiz_title}) حصول الطالب على (${score} من ${max_score}). نرجو التعاون وحثه على المراجعة الجادة لرفع مستواه في الاختبار القادم ⚠️.`,
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

  let message = `${greeting}\n${body}`;
  if (note && note.trim()) {
    message += `\nملاحظة المعلم: ${note.trim()}`;
  }
  if (teacher_name && teacher_name.trim()) {
    message += `\nمع تحيات: ${teacher_name.trim()}`;
  } else {
    spintaxState.quizClosingIdx = getRotatedIndex(closings.length, spintaxState.quizClosingIdx);
    message += `\n${closings[spintaxState.quizClosingIdx]}`;
  }

  return message;
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
