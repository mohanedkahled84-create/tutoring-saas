import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateJitterDelay,
  checkWarmUpLimit,
  recordHealthError,
  recordHealthSuccess,
  getHealthStatus,
  validateBusinessProfile,
  WhatsAppNotificationsService,
} from "../dist/features/whatsapp-notifications/index.js";

/**
 * In-Memory Fake WhatsApp Repository
 */
class FakeWhatsAppRepository {
  constructor() {
    this.templates = [];
    this.dispatchedKeys = new Set();
  }

  async isMessageDispatched(key) {
    return this.dispatchedKeys.has(key);
  }

  async getTemplates(tenantId) {
    return tenantId
      ? this.templates.filter((t) => t.tenant_id === tenantId)
      : this.templates;
  }

  async upsertTemplate(tmpl) {
    const existingIdx = this.templates.findIndex(
      (t) => t.tenant_id === tmpl.tenant_id && t.template_type === tmpl.template_type
    );
    const saved = { id: `tmpl-${this.templates.length + 1}`, ...tmpl };
    if (existingIdx >= 0) {
      this.templates[existingIdx] = saved;
    } else {
      this.templates.push(saved);
    }
    return saved;
  }

  async getConnectionStatus() {
    return {
      status: "connected",
      phone_number: "+201099887766",
      gateway: "Evolution API v2.1",
      latency_ms: 95,
      daily_quota: { used: 50, limit: 500, safety_score: "excellent" },
    };
  }
}

// ========================================================
// DEV-65: WhatsApp & Anti-Ban Tests
// ========================================================

test("DEV-65: calculateJitterDelay stays within configured bounds", () => {
  for (let i = 0; i < 20; i++) {
    const delay = calculateJitterDelay({ minDelayMs: 4000, maxDelayMs: 9000 });
    assert.ok(delay >= 3900 && delay <= 9100, `Delay ${delay} was out of expected range`);
  }
});

test("DEV-65: checkWarmUpLimit enforces daily graduated pacing", () => {
  const now = new Date();
  // Day 1
  const day1Check = checkWarmUpLimit({ connected_at: now }, 15);
  assert.equal(day1Check.day_number, 1);
  assert.equal(day1Check.daily_limit, 20);
  assert.equal(day1Check.allowed, true);

  // Day 1 exceeding limit
  const day1Exceeded = checkWarmUpLimit({ connected_at: now }, 25);
  assert.equal(day1Exceeded.allowed, false);
  assert.ok(day1Exceeded.reason);

  // Legacy exempt
  const legacyCheck = checkWarmUpLimit({ connected_at: now, is_legacy_exempt: true }, 500);
  assert.equal(legacyCheck.allowed, true);
  assert.equal(legacyCheck.is_warm, true);
});

test("DEV-65: Circuit breaker pauses sending after 3 consecutive errors", () => {
  const testTenant = "tenant-circuit-test";
  recordHealthSuccess(testTenant);

  assert.equal(recordHealthError(testTenant, "rate_limit_429"), "DEGRADED");
  assert.equal(recordHealthError(testTenant, "rate_limit_429"), "DEGRADED");
  assert.equal(recordHealthError(testTenant, "disconnect"), "CIRCUIT_OPEN_PAUSED");

  const status = getHealthStatus(testTenant);
  assert.equal(status.circuit_state, "CIRCUIT_OPEN_PAUSED");
  assert.equal(status.can_send, false);
  assert.ok(status.paused_until);
});

test("DEV-65: validateBusinessProfile audits WhatsApp business profile readiness", () => {
  const incomplete = validateBusinessProfile({
    business_name: "AI", // too short
  });
  assert.equal(incomplete.is_compliant, false);
  assert.ok(incomplete.missing_requirements.length >= 3);

  const complete = validateBusinessProfile({
    business_name: "Centrly Educational Academy",
    profile_picture_url: "https://example.com/logo.png",
    category: "Education",
    description: "Professional tutoring management platform in Egypt",
  });
  assert.equal(complete.is_compliant, true);
  assert.equal(complete.score_percentage, 100);
});

test("DEV-65: WhatsAppNotificationsService saves and lists templates", async () => {
  const fakeRepo = new FakeWhatsAppRepository();
  const service = new WhatsAppNotificationsService(fakeRepo);

  await service.saveTemplate("tenant-1", "attendance_absent", ["تنبيه غياب: الطالب غير حاضر"]);
  const templates = await service.listTemplates("tenant-1");

  assert.equal(templates.length, 1);
  assert.equal(templates[0].template_type, "attendance_absent");
});

test("DEV-65: dispatchAttendanceWebhook skips present students with no comments", async () => {
  const fakeRepo = new FakeWhatsAppRepository();
  const service = new WhatsAppNotificationsService(fakeRepo);

  const dispatched = await service.dispatchAttendanceWebhook({
    tenant_id: "tenant-1",
    event_type: "attendance_recorded",
    student_id: "stu-1",
    student_name: "Sara",
    session_id: "sess-1",
    attended: true,
    comment: "", // empty comment -> should skip
    parent_phone: "01011112222",
    idempotency_key: "tenant-1:stu-1:sess-1",
  });

  assert.equal(dispatched, false);
});
