import {
  TelemetryEventInput,
  ITelemetryRepository,
} from "./types.js";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "access_token",
  "authorization",
  "api_key",
]);

/**
 * Sanitizes event properties to ensure no accidental credential leakage in telemetry.
 */
export function sanitizeTelemetryProperties(
  props?: Record<string, unknown>
): Record<string, unknown> {
  if (!props || typeof props !== "object") return {};
  const cleaned: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(props)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      cleaned[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      cleaned[key] = sanitizeTelemetryProperties(val as Record<string, unknown>);
    } else {
      cleaned[key] = val;
    }
  }

  return cleaned;
}

export class TelemetryService {
  constructor(private readonly repo: ITelemetryRepository) {}

  /**
   * DEV-55: Records a batch of behavior tracking events.
   * Enforces sanitization and non-blocking performance.
   */
  async trackEvents(
    tenantId: string | null | undefined,
    events: TelemetryEventInput[]
  ): Promise<{ recorded_count: number; message: string }> {
    if (!events || !Array.isArray(events) || events.length === 0) {
      return { recorded_count: 0, message: "No events to record" };
    }

    const sanitizedEvents = events.map((e) => ({
      event_name: e.event_name,
      properties: sanitizeTelemetryProperties(e.properties),
      page_path: e.page_path,
      session_id: e.session_id,
      timestamp: e.timestamp || new Date().toISOString(),
    }));

    const count = await this.repo.recordEvents(tenantId, sanitizedEvents);
    return {
      recorded_count: count,
      message: `Successfully recorded ${count} telemetry events`,
    };
  }
}
