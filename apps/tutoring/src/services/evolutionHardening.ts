import { logger } from "../utils/logger.js";

// ============================================================================
// DEV-EAH.1: Randomized Send Delay (Jitter)
// Replaces fixed delays with randomized delay between 4,000ms and 9,000ms (~7-10 msgs/min)
// ============================================================================
export interface JitterConfig {
  minDelayMs: number; // e.g. 4000
  maxDelayMs: number; // e.g. 9000
}

export const DEFAULT_JITTER_CONFIG: JitterConfig = {
  minDelayMs: 4000,
  maxDelayMs: 9000,
};

let lastGeneratedDelay = 0;

export function calculateJitterDelay(config: JitterConfig = DEFAULT_JITTER_CONFIG): number {
  const range = config.maxDelayMs - config.minDelayMs;
  let delay = config.minDelayMs + Math.floor(Math.random() * (range + 1));

  // Ensure two consecutive calls never have identical millisecond timing
  if (delay === lastGeneratedDelay) {
    delay += Math.random() > 0.5 ? 47 : -47;
  }
  lastGeneratedDelay = delay;
  return delay;
}

// ============================================================================
// DEV-EAH.2: New-Number Warm-Up Protocol
// Ramps up new WhatsApp numbers over 5-7 days. Omar Gamal is legacy exempt.
// ============================================================================
export const WARMUP_SCHEDULE: Record<number, number> = {
  1: 20,   // Day 1: max 20 msgs
  2: 40,   // Day 2: max 40 msgs
  3: 80,   // Day 3: max 80 msgs
  4: 150,  // Day 4: max 150 msgs
  5: 300,  // Day 5: max 300 msgs
  6: 600,  // Day 6: max 600 msgs
};

export const MAX_DAILY_VOLUME = 1200; // Normal steady-state cap

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

export function checkWarmUpLimit(
  connection: ConnectionWarmUpInfo,
  sentTodayCount: number
): WarmUpCheckResult {
  // Omar Gamal's legacy instance has run for months -> exempt from warm-up
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

// ============================================================================
// DEV-EAH.3: Connection Health Monitoring & Circuit Breaker
// Pauses sending automatically on repeated disconnects or 429 rate limit errors
// ============================================================================
export type CircuitState = "HEALTHY" | "DEGRADED" | "CIRCUIT_OPEN_PAUSED";

interface HealthState {
  recentErrors: Array<{ type: string; timestamp: number }>;
  circuitState: CircuitState;
  pausedUntil?: number;
}

const tenantHealthMap = new Map<string, HealthState>();
const ERROR_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ERRORS_BEFORE_PAUSE = 3;
const PAUSE_DURATION_MS = 30 * 60 * 1000; // 30 minutes cooldown

export function recordHealthSuccess(tenantId: string): void {
  const state = tenantHealthMap.get(tenantId);
  if (state && state.circuitState !== "CIRCUIT_OPEN_PAUSED") {
    state.recentErrors = [];
    state.circuitState = "HEALTHY";
  }
}

export function recordHealthError(tenantId: string, errorType: "disconnect" | "rate_limit_429" | "timeout"): CircuitState {
  const now = Date.now();
  let state = tenantHealthMap.get(tenantId);

  if (!state) {
    state = { recentErrors: [], circuitState: "HEALTHY" };
    tenantHealthMap.set(tenantId, state);
  }

  // Filter out expired errors
  state.recentErrors = state.recentErrors.filter((e) => now - e.timestamp < ERROR_WINDOW_MS);
  state.recentErrors.push({ type: errorType, timestamp: now });

  if (state.recentErrors.length >= MAX_ERRORS_BEFORE_PAUSE) {
    state.circuitState = "CIRCUIT_OPEN_PAUSED";
    state.pausedUntil = now + PAUSE_DURATION_MS;
    logger.warn(`[AntiBanCircuitBreaker] Tenant ${tenantId} PAUSED for 30m due to ${state.recentErrors.length} errors (${errorType})`);
  } else if (state.recentErrors.length >= 1) {
    state.circuitState = "DEGRADED";
  }

  return state.circuitState;
}

export function getHealthStatus(tenantId: string): {
  circuit_state: CircuitState;
  can_send: boolean;
  paused_until?: string;
  error_count: number;
} {
  const state = tenantHealthMap.get(tenantId);
  const now = Date.now();

  if (!state) {
    return { circuit_state: "HEALTHY", can_send: true, error_count: 0 };
  }

  if (state.circuitState === "CIRCUIT_OPEN_PAUSED" && state.pausedUntil) {
    if (now >= state.pausedUntil) {
      // Cooldown expired, move to degraded half-open
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

// ============================================================================
// DEV-EAH.4: Business Profile Setup Checklist
// Validates dedicated business profile so new numbers don't appear as blank spam bots
// ============================================================================
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

export function validateBusinessProfile(profile: BusinessProfileData): ProfileChecklistResult {
  const has_name = Boolean(profile.business_name && profile.business_name.trim().length >= 3);
  const has_profile_picture = Boolean(profile.profile_picture_url && profile.profile_picture_url.startsWith("http"));
  const has_category = Boolean(profile.category && profile.category.trim().length > 0);
  const has_description = Boolean(profile.description && profile.description.trim().length >= 10);

  const missing: string[] = [];
  if (!has_name) missing.push("اسم النشاط التجاري (Business Name >= 3 chars)");
  if (!has_profile_picture) missing.push("صورة الملف التعريفي للواتساب (Profile Picture URL)");
  if (!has_category) missing.push("فئة النشاط (Category, e.g. Education / مركز تعليمي)");
  if (!has_description) missing.push("وصف النشاط التجاري (Description >= 10 chars)");

  const passedCount = [has_name, has_profile_picture, has_category, has_description].filter(Boolean).length;
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
