import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../dist/app.js";
import {
  calculateJitterDelay,
  calculateInitialJitterDelay,
  checkWarmUpLimit,
  recordHealthError,
  recordHealthSuccess,
  getHealthStatus,
  validateBusinessProfile,
  WhatsAppNotificationsService,
  generateQuizScoreMessage,
  generateAttendanceMessage,
  resetTenantDailyCount,
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

class FakeTestGateway {
  constructor(shouldFail = false) {
    this.shouldFail = shouldFail;
    this.sentMessages = [];
  }

  async sendTextMessage(instanceName, number, text) {
    if (this.shouldFail) {
      return { success: false, error: "Simulated gateway failure" };
    }
    this.sentMessages.push({ instanceName, number, text });
    return { success: true };
  }
}

// ========================================================
// DEV-65: WhatsApp & Anti-Ban Tests
// ========================================================

test("DEV-65: calculateJitterDelay stays within configured bounds", () => {
  // Test explicit custom bounds
  for (let i = 0; i < 20; i++) {
    const delay = calculateJitterDelay({ minDelayMs: 4000, maxDelayMs: 9000 });
    assert.ok(delay >= 3900 && delay <= 9100, `Delay ${delay} was out of expected range`);
  }

  // Test default bounds (20s to 40s)
  for (let i = 0; i < 20; i++) {
    const defaultDelay = calculateJitterDelay();
    assert.ok(defaultDelay >= 19900 && defaultDelay <= 40100, `Default delay ${defaultDelay} was out of 20s-40s range`);
  }

  // Test initial delay bounds (5s to 10s)
  for (let i = 0; i < 20; i++) {
    const initDelay = calculateInitialJitterDelay();
    assert.ok(initDelay >= 4900 && initDelay <= 10100, `Initial delay ${initDelay} was out of 5s-10s range`);
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

test("DEV-QUIZ.1: generateQuizScoreMessage generates tailored spintax messages based on score tier", () => {
  // 1. Excellent score (>= 85%)
  const msgExcellent = generateQuizScoreMessage({
    student_name: "زياد أحمد",
    quiz_title: "كويز 1 فيزياء",
    score: 9.5,
    max_score: 10,
    teacher_name: "مستر محمد",
    note: "إجابات نموذجية",
  });

  assert.ok(msgExcellent.includes("زياد أحمد"));
  assert.ok(msgExcellent.includes("كويز 1 فيزياء"));
  assert.ok(msgExcellent.includes("9.5 من 10"));
  assert.ok(msgExcellent.includes("إجابات نموذجية"));
  assert.ok(msgExcellent.includes("مستر محمد"));

  // 2. Good score (65-84%)
  const msgGood = generateQuizScoreMessage({
    student_name: "محمود علي",
    quiz_title: "كويز كيمياء",
    score: 7,
    max_score: 10,
  });
  assert.ok(msgGood.includes("محمود علي"));
  assert.ok(msgGood.includes("7 من 10"));

  // 3. Needs attention (< 65%)
  const msgNeedsAttention = generateQuizScoreMessage({
    student_name: "سارة خالد",
    quiz_title: "كويز أحياء",
    score: 4,
    max_score: 10,
    note: "يرجى إعادة مذاكرة الباب الأول",
  });
  assert.ok(msgNeedsAttention.includes("سارة خالد"));
  assert.ok(msgNeedsAttention.includes("4 من 10"));
  assert.ok(msgNeedsAttention.includes("يرجى إعادة مذاكرة الباب الأول"));
});

test("DEV-QUIZ.2: sendQuizScore routes to teacher instance with anti-ban protections", async () => {
  const repo = new FakeWhatsAppRepository();
  const gateway = new FakeTestGateway();
  const service = new WhatsAppNotificationsService(repo, gateway);
  const tenantId = "tenant-quiz-test-1";
  recordHealthSuccess(tenantId);
  resetTenantDailyCount(tenantId);

  const res = await service.sendQuizScore({
    tenant_id: tenantId,
    teacher_id: "teach-123",
    student_id: "s-1",
    student_name: "كريم حاتم",
    parent_phone: "01012345678",
    quiz_title: "كويز 1",
    score: 9,
    max_score: 10,
    teacher_name: "أ. محمود",
  });

  assert.equal(res.success, true);
  assert.equal(res.gateway_sent, true);
  assert.equal(gateway.sentMessages.length, 1);
  assert.equal(gateway.sentMessages[0].instanceName, "centrly_tenant_tenant-quiz-test-1_teacher_teach-123");
  assert.equal(gateway.sentMessages[0].number, "01012345678");
});

test("DEV-QUIZ.3: batchSendQuizScores processes batch with anti-ban pacing and circuit protection", async () => {
  const repo = new FakeWhatsAppRepository();
  const gateway = new FakeTestGateway();
  const service = new WhatsAppNotificationsService(repo, gateway);
  const tenantId = "tenant-quiz-batch-test";
  recordHealthSuccess(tenantId);
  resetTenantDailyCount(tenantId);

  const students = [
    { student_id: "s-1", student_name: "طالب 1", parent_phone: "01011111111", score: 10, note: "أول المجموعة" },
    { student_id: "s-2", student_name: "طالب 2", parent_phone: "01022222222", score: 8 },
    { student_id: "s-3", student_name: "طالب 3", parent_phone: "01033333333", score: 5 },
  ];

  const batchRes = await service.batchSendQuizScores(
    tenantId,
    students,
    {
      quiz_title: "كويز المراجعة",
      max_score: 10,
      teacher_id: "teach-math",
      teacher_name: "أستاذ الرياضيات",
      pacingDelayMs: 0,
    }
  );

  assert.equal(batchRes.total, 3);
  assert.equal(batchRes.sent_count, 3);
  assert.equal(batchRes.failed_count, 0);
  assert.equal(batchRes.skipped_count, 0);
  assert.equal(gateway.sentMessages.length, 3);

  assert.equal(gateway.sentMessages[0].number, "01011111111");
  assert.equal(gateway.sentMessages[1].number, "01022222222");
  assert.equal(gateway.sentMessages[2].number, "01033333333");
});

test("DEV-QUIZ.4: batchSendQuizScores respects Circuit Breaker when paused", async () => {
  const repo = new FakeWhatsAppRepository();
  const gateway = new FakeTestGateway();
  const service = new WhatsAppNotificationsService(repo, gateway);
  const tenantId = "tenant-circuit-quiz";

  // Force trip circuit breaker
  recordHealthError(tenantId, "disconnect");
  recordHealthError(tenantId, "disconnect");
  recordHealthError(tenantId, "disconnect");

  const batchRes = await service.batchSendQuizScores(
    tenantId,
    [{ student_id: "s-1", student_name: "علي", parent_phone: "01000000000", score: 9 }],
    { quiz_title: "كويز", pacingDelayMs: 0 }
  );

  assert.equal(batchRes.sent_count, 0);
  assert.equal(batchRes.skipped_count, 1);
  assert.equal(batchRes.results[0].status, "skipped_circuit_open");
});

test("DEV-QUIZ.9: sendQuizScore supports direct student dispatch and dual parent+student dispatch", async () => {
  const repo = new FakeWhatsAppRepository();
  const gateway = new FakeTestGateway();
  const service = new WhatsAppNotificationsService(repo, gateway);
  const tenantId = "tenant-quiz-student-test";
  recordHealthSuccess(tenantId);
  resetTenantDailyCount(tenantId);

  // 1. Student-only dispatch
  const studentOnlyRes = await service.sendQuizScore({
    tenant_id: tenantId,
    teacher_id: "teach-chem",
    student_id: "std-55",
    student_name: "حمزة طارق",
    student_phone: "01199887766",
    recipient_type: "student",
    quiz_title: "كويز كيمياء عضويّة",
    score: 9,
    max_score: 10,
    teacher_name: "مستر أحمد",
  });

  assert.equal(studentOnlyRes.success, true);
  assert.equal(studentOnlyRes.gateway_sent, true);
  assert.deepEqual(studentOnlyRes.sent_to, ["student"]);
  assert.ok(studentOnlyRes.message_text.includes("حمزة طارق"));
  assert.ok(studentOnlyRes.message_text.includes("عزيزنا الطالب") || studentOnlyRes.message_text.includes("يا (حمزة طارق)"));
  assert.equal(gateway.sentMessages.length, 1);
  assert.equal(gateway.sentMessages[0].number, "01199887766");

  // 2. Dual dispatch (both parent and student)
  const dualRes = await service.sendQuizScore({
    tenant_id: tenantId,
    teacher_id: "teach-chem",
    student_id: "std-56",
    student_name: "رنا سعيد",
    parent_phone: "01011223344",
    student_phone: "01233445566",
    recipient_type: "both",
    quiz_title: "كويز 2 كيمياء",
    score: 8.5,
    max_score: 10,
    teacher_name: "مستر أحمد",
  });

  assert.equal(dualRes.success, true);
  assert.equal(dualRes.gateway_sent, true);
  assert.deepEqual(dualRes.sent_to, ["parent", "student"]);
  assert.equal(gateway.sentMessages.length, 3); // 1 + 2 = 3
  assert.equal(gateway.sentMessages[1].number, "01011223344"); // parent
  assert.equal(gateway.sentMessages[2].number, "01233445566"); // student
  assert.ok(gateway.sentMessages[1].text.includes("رنا سعيد"));
  assert.ok(gateway.sentMessages[1].text.includes("8.5 من 10"));
  assert.ok(gateway.sentMessages[2].text.includes("رنا سعيد"));
  assert.ok(gateway.sentMessages[2].text.includes("8.5 من 10"));
  assert.ok(gateway.sentMessages[2].text.includes("عزيزنا الطالب") || gateway.sentMessages[2].text.includes("يا (رنا سعيد)"));
});

test("DEV-NOTIF.1: batchSendCustomNotification sends alerts to students with Anti-Ban pacing", async () => {
  const repo = new FakeWhatsAppRepository();
  const gateway = new FakeTestGateway();
  const service = new WhatsAppNotificationsService(repo, gateway);
  const tenantId = "tenant-notif-test";
  recordHealthSuccess(tenantId);
  resetTenantDailyCount(tenantId);

  const students = [
    { recipient_id: "s-1", recipient_name: "أحمد", phone: "01011112222" },
    { recipient_id: "s-2", recipient_name: "مروان", phone: "01033334444" },
  ];

  const res = await service.batchSendCustomNotification(
    tenantId,
    students,
    {
      event_type: "rescheduled",
      group_name: "مجموعة السبت",
      date: "2026-09-15",
      time: "05:00 م",
      reason: "عطل طارئ بالقاعة",
      teacher_name: "مستر أحمد",
      pacingDelayMs: 0,
    }
  );

  assert.equal(res.total, 2);
  assert.equal(res.sent_count, 2);
  assert.equal(gateway.sentMessages.length, 2);
  assert.ok(gateway.sentMessages[0].text.includes("أحمد"));
  assert.ok(gateway.sentMessages[0].text.includes("2026-09-15"));
  assert.ok(gateway.sentMessages[0].text.includes("عطل طارئ بالقاعة"));
});

test("DEV-SPIN.1: generateAttendanceMessage produces varied spintax messages for present and absent", () => {
  // Attended student with homework and comment
  const presentMsg = generateAttendanceMessage({
    student_name: "عمر خالد",
    attended: true,
    homework_status: "done",
    comment: "مشارك ممتاز في حل المسائل",
    teacher_name: "محمد علي",
  });

  assert.ok(presentMsg.includes("عمر خالد"));
  assert.ok(presentMsg.includes("مكتمل وممتاز"));
  assert.ok(presentMsg.includes("مشارك ممتاز في حل المسائل"));
  assert.ok(presentMsg.includes("مستر محمد علي"));

  // Absent student
  const absentMsg = generateAttendanceMessage({
    student_name: "يوسف أحمد",
    attended: false,
  });

  assert.ok(absentMsg.includes("يوسف أحمد"));
  assert.ok(absentMsg.includes("غياب") || absentMsg.includes("تغيب"));
});

test("DEV-SPIN.2: generateAttendanceMessage rotates templates across consecutive messages so they are never identical", () => {
  const msg1 = generateAttendanceMessage({
    student_name: "طالب أ",
    attended: true,
    homework_status: "done",
    comment: "ملاحظة أولى",
  });

  const msg2 = generateAttendanceMessage({
    student_name: "طالب ب",
    attended: true,
    homework_status: "done",
    comment: "ملاحظة ثانية",
  });

  // Greetings and structures must differ due to anti-repetition rotation
  const greeting1 = msg1.split("\n")[0];
  const greeting2 = msg2.split("\n")[0];
  assert.notEqual(greeting1.replace("طالب أ", ""), greeting2.replace("طالب ب", ""), "Consecutive greetings must rotate and differ");

  // Homework lines must also rotate
  const hw1 = msg1.split("\n").find(l => l.includes("الواجب"));
  const hw2 = msg2.split("\n").find(l => l.includes("الواجب"));
  assert.notEqual(hw1, hw2, "Consecutive homework phrasing must rotate and differ");
});
