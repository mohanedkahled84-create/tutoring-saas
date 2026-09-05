import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { SessionsService } from "../dist/features/sessions/service.js";
import { GroupsService } from "../dist/features/groups/service.js";
import { FakeGroupsRepository } from "../dist/features/groups/repository.js";
import {
  computeErrorFingerprint,
  formatCriticalAlertEmail,
  dispatchCriticalErrorAlert,
  clearAlertDeduplicationCache,
} from "../dist/features/admin-ops/criticalErrorAlert.js";
import { BusinessDashboardService } from "../dist/features/business-dashboard/service.js";
import { FakeBusinessDashboardRepository } from "../dist/features/business-dashboard/repository.js";
import { renderBusinessOwnerDashboard } from "../../../apps/web/src/components/BusinessOwnerDashboard.js";
import {
  TelemetryService,
  sanitizeTelemetryProperties,
} from "../dist/features/telemetry/service.js";
import { FakeTelemetryRepository } from "../dist/features/telemetry/repository.js";
import { analytics } from "../../../apps/web/src/utils/analytics.js";
import { renderTeacherCalendar } from "../../../apps/web/src/components/TeacherCalendar.js";
import { app } from "../dist/app.js";

// Mock Repository for domain unit tests
class MockSessionsRepo {
  constructor() {
    this.session = {
      id: "sess-101",
      tenant_id: "tenant-abc",
      group_id: "grp-202",
      session_number: 3,
      session_date: "2026-09-10",
      created_at: new Date().toISOString(),
      status: "scheduled",
    };
    this.group = {
      id: "grp-202",
      name: "مجموعة الصف الثالث الثانوي",
      price: 150,
      billing_model: "percentage",
    };
    this.students = [
      { id: "stu-1", name: "أحمد علي", parent_phone: "01012345678" },
      { id: "stu-2", name: "سارة محمد", parent_phone: "01198765432" },
      { id: "stu-3", name: "محمود بدون هاتف", parent_phone: "" },
    ];
    this.loggedNotifications = [];
  }

  async getSessionWithGroup(sessionId) {
    if (sessionId !== this.session.id) return null;
    return { session: this.session, group: this.group };
  }

  async cancelSession(sessionId, reason) {
    this.session.status = "cancelled";
    this.session.cancellation_reason = reason || null;
    return { ...this.session };
  }

  async rescheduleSession(sessionId, newDate, newTime, reason) {
    this.session.status = "rescheduled";
    this.session.rescheduled_to_date = newDate;
    this.session.rescheduled_to_time = newTime || null;
    this.session.cancellation_reason = reason || null;
    return { ...this.session };
  }

  async getNextSessionNumber(groupId) {
    return 4;
  }

  async createExtraSession(tenantId, input, nextSessionNumber) {
    const newSession = {
      id: "sess-extra-999",
      tenant_id: tenantId,
      group_id: input.group_id,
      session_number: nextSessionNumber,
      session_date: input.session_date,
      is_extra: true,
      extra_topic: input.topic || null,
      status: "scheduled",
      created_at: new Date().toISOString(),
    };
    this.session = newSession;
    return newSession;
  }

  async getStudentsForGroup(groupId) {
    return this.students;
  }

  async logSessionActionNotification(tenantId, idempotencyKey, phone, messageType, content) {
    this.loggedNotifications.push({ tenantId, idempotencyKey, phone, messageType, content });
    return "msg-log-" + this.loggedNotifications.length;
  }

  async getSessionsByDateRange(tenantId, fromDate, toDate) {
    if (
      this.session.tenant_id === tenantId &&
      this.session.session_date >= fromDate &&
      this.session.session_date <= toDate
    ) {
      return [{ ...this.session, groups: this.group }];
    }
    return [];
  }
}

test("DEV-50: cancelSession updates status to cancelled and logs parent notifications", async () => {
  const repo = new MockSessionsRepo();
  const service = new SessionsService(repo);

  const result = await service.cancelSession("tenant-abc", "sess-101", {
    reason: "عذر طارئ للمدرس",
    notify_parents: true,
  });

  assert.equal(result.action, "cancelled");
  assert.equal(result.session.status, "cancelled");
  assert.equal(result.session.cancellation_reason, "عذر طارئ للمدرس");
  // Only students with valid parent_phone get dispatched (2 of 3)
  assert.equal(result.notifications_dispatched, 2);
  assert.equal(repo.loggedNotifications.length, 2);
  assert.ok(repo.loggedNotifications[0].content.includes("إلغاء حصة"));
  assert.ok(repo.loggedNotifications[0].content.includes("عذر طارئ للمدرس"));
  assert.equal(
    repo.loggedNotifications[0].idempotencyKey,
    "cancel:tenant-abc:sess-101:stu-1"
  );
});

test("DEV-50: cancelSession with notify_parents: false skips notification dispatch", async () => {
  const repo = new MockSessionsRepo();
  const service = new SessionsService(repo);

  const result = await service.cancelSession("tenant-abc", "sess-101", {
    reason: "تأجيل داخلي",
    notify_parents: false,
  });

  assert.equal(result.session.status, "cancelled");
  assert.equal(result.notifications_dispatched, 0);
  assert.equal(repo.loggedNotifications.length, 0);
});

test("DEV-50: rescheduleSession updates status, sets new date/time, and notifies parents", async () => {
  const repo = new MockSessionsRepo();
  const service = new SessionsService(repo);

  const result = await service.rescheduleSession("tenant-abc", "sess-101", {
    new_date: "2026-09-15",
    new_time: "06:00 PM",
    reason: "تغيير موعد القاعة",
    notify_parents: true,
  });

  assert.equal(result.action, "rescheduled");
  assert.equal(result.session.status, "rescheduled");
  assert.equal(result.session.rescheduled_to_date, "2026-09-15");
  assert.equal(result.session.rescheduled_to_time, "06:00 PM");
  assert.equal(result.notifications_dispatched, 2);
  assert.ok(repo.loggedNotifications[0].content.includes("تعديل موعد حصة"));
  assert.ok(repo.loggedNotifications[0].content.includes("2026-09-15"));
  assert.equal(
    repo.loggedNotifications[0].idempotencyKey,
    "reschedule:tenant-abc:sess-101:stu-1:2026-09-15"
  );
});

test("DEV-50: createExtraSession marks is_extra, increments number, and notifies parents", async () => {
  const repo = new MockSessionsRepo();
  const service = new SessionsService(repo);

  const result = await service.createExtraSession("tenant-abc", {
    group_id: "grp-202",
    session_date: "2026-09-18",
    session_time: "04:00 PM",
    topic: "مراجعة شاملة على الباب الأول",
    notify_parents: true,
  });

  assert.equal(result.action, "extra");
  assert.equal(result.session.is_extra, true);
  assert.equal(result.session.session_number, 4);
  assert.equal(result.session.status, "scheduled");
  assert.equal(result.notifications_dispatched, 2);
  assert.ok(repo.loggedNotifications[0].content.includes("حصة إضافية"));
  assert.ok(repo.loggedNotifications[0].content.includes("مراجعة شاملة على الباب الأول"));
});

// HTTP Security & Unauthenticated Access Tests for DEV-50
let server;
let baseUrl;

test.before((t, done) => {
  server = http.createServer(app);
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    done();
  });
});

test.after((t, done) => {
  server.close(done);
});

test("DEV-50: POST /api/sessions/:id/cancel strictly returns 401 when unauthenticated", async () => {
  const res = await fetch(`${baseUrl}/api/sessions/00000000-0000-0000-0000-000000000001/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "unauthenticated cancel" }),
  });
  assert.equal(res.status, 401);
});

test("DEV-50: POST /api/sessions/:id/reschedule strictly returns 401 when unauthenticated", async () => {
  const res = await fetch(`${baseUrl}/api/sessions/00000000-0000-0000-0000-000000000001/reschedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_date: "2026-09-20" }),
  });
  assert.equal(res.status, 401);
});

test("DEV-50: POST /api/sessions/extra strictly returns 401 when unauthenticated", async () => {
  const res = await fetch(`${baseUrl}/api/sessions/extra`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      group_id: "00000000-0000-0000-0000-000000000001",
      session_date: "2026-09-20",
    }),
  });
  assert.equal(res.status, 401);
});

// ============================================================================
// DEV-49: Class Sub-Groups (Sections) Tests
// ============================================================================

test("DEV-49: createSection creates sub-group inheriting parent attributes and full name", async () => {
  const repo = new FakeGroupsRepository();
  const service = new GroupsService(repo);

  const parent = await service.createGroup("tenant-1", {
    name: "ثانوية عامة - دفعة 2026",
    price: 120,
    billing_model: "percentage",
    center_name: "سنتر الأوائل",
  });

  const section = await service.createSection("tenant-1", parent.id, {
    section_name: "مجموعة أ (صباحي)",
  });

  assert.equal(section.is_section, true);
  assert.equal(section.parent_group_id, parent.id);
  assert.equal(section.section_name, "مجموعة أ (صباحي)");
  assert.equal(section.name, "ثانوية عامة - دفعة 2026 - مجموعة أ (صباحي)");
  assert.equal(section.price, 120);
  assert.equal(section.center_name, "سنتر الأوائل");
});

test("DEV-49: createSection throws PARENT_GROUP_NOT_FOUND when parent is missing", async () => {
  const repo = new FakeGroupsRepository();
  const service = new GroupsService(repo);

  await assert.rejects(
    async () => {
      await service.createSection("tenant-1", "non-existent-parent", {
        section_name: "مجموعة أ",
      });
    },
    /PARENT_GROUP_NOT_FOUND/
  );
});

test("DEV-49: listSections filters sections and masks prices for assistant role", async () => {
  const repo = new FakeGroupsRepository();
  const service = new GroupsService(repo);

  const parent = await service.createGroup("tenant-1", {
    name: "لغة عربية - تانية ثانوي",
    price: 100,
  });

  await service.createSection("tenant-1", parent.id, { section_name: "سكشن 1" });
  await service.createSection("tenant-1", parent.id, { section_name: "سكشن 2" });

  const teacherView = await service.listSections(parent.id, "teacher");
  assert.equal(teacherView.length, 2);
  assert.equal(teacherView[0].price, 100);

  const assistantView = await service.listSections(parent.id, "assistant");
  assert.equal(assistantView.length, 2);
  assert.equal(assistantView[0].price, undefined);
  assert.equal(assistantView[0].billing_model, undefined);
});

test("DEV-49: getGroupRollUp aggregates sections, students, and masks revenue for assistant", async () => {
  const repo = new FakeGroupsRepository();
  const service = new GroupsService(repo);

  const parent = await service.createGroup("tenant-1", {
    name: "فيزياء - تالتة ثانوي",
    price: 150,
  });

  const sec1 = await service.createSection("tenant-1", parent.id, { section_name: "مجموعة السبت" });
  const sec2 = await service.createSection("tenant-1", parent.id, { section_name: "مجموعة الأحد" });

  await service.enrollStudent("tenant-1", sec1.id, "stu-1");
  await service.enrollStudent("tenant-1", sec1.id, "stu-2");
  await service.enrollStudent("tenant-1", sec2.id, "stu-3");

  const reportTeacher = await service.getGroupRollUp(parent.id, "teacher");
  assert.equal(reportTeacher.total_sections, 2);
  assert.equal(reportTeacher.total_students_enrolled, 3);
  assert.equal(reportTeacher.total_revenue, 450); // 3 * 150

  const reportAssistant = await service.getGroupRollUp(parent.id, "assistant");
  assert.equal(reportAssistant.total_sections, 2);
  assert.equal(reportAssistant.total_students_enrolled, 3);
  assert.equal(reportAssistant.total_revenue, undefined); // Masked for assistant
});

test("DEV-49: Section and roll-up endpoints strictly return 401 when unauthenticated", async () => {
  const res1 = await fetch(`${baseUrl}/api/groups/00000000-0000-0000-0000-000000000001/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section_name: "Section A" }),
  });
  assert.equal(res1.status, 401);

  const res2 = await fetch(`${baseUrl}/api/groups/00000000-0000-0000-0000-000000000001/sections`);
  assert.equal(res2.status, 401);

  const res3 = await fetch(`${baseUrl}/api/groups/00000000-0000-0000-0000-000000000001/roll-up`);
  assert.equal(res3.status, 401);
});

// ============================================================================
// DEV-51: Critical Error → Email Alert Channel (Ops Alerting) Tests
// ============================================================================

test("DEV-51: computeErrorFingerprint normalizes IDs and generates deterministic hash", () => {
  const fp1 = computeErrorFingerprint({
    error_name: "DatabaseTimeout",
    error_message: "Failed to connect to tenant aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee query timed out",
    context: { path: "/api/sessions" },
  });

  const fp2 = computeErrorFingerprint({
    error_name: "DatabaseTimeout",
    error_message: "Failed to connect to tenant 11111111-2222-3333-4444-555555555555 query timed out",
    context: { path: "/api/sessions" },
  });

  assert.equal(fp1, fp2);
});

test("DEV-51: formatCriticalAlertEmail formats HTML and plain text with Cairo time", () => {
  const { subject, html, text } = formatCriticalAlertEmail(
    {
      error_name: "CircuitBreakerOpen",
      error_message: "WhatsApp sending tripped for tenant-123",
      stack: "Error: WhatsApp timeout\n    at dispatch (service.ts:100)",
      severity: "CRITICAL",
      context: { path: "/api/sessions/end", method: "POST", request_id: "req-999" },
    },
    5
  );

  assert.ok(subject.includes("CRITICAL ALERT"));
  assert.ok(subject.includes("CircuitBreakerOpen"));
  assert.ok(text.includes("5 duplicate occurrences were suppressed"));
  assert.ok(html.includes("req-999"));
  assert.ok(html.includes("POST /api/sessions/end"));
});

test("DEV-51: dispatchCriticalErrorAlert filters INFO severity to prevent alert fatigue", async () => {
  const result = await dispatchCriticalErrorAlert({
    error_name: "NotFoundError",
    error_message: "Student not found",
    severity: "INFO",
  });

  assert.equal(result.dispatched, false);
  assert.equal(result.suppressed, true);
  assert.ok(result.reason.includes("INFO severity"));
});

test("DEV-51: dispatchCriticalErrorAlert rate limits and deduplicates repeated errors", async () => {
  clearAlertDeduplicationCache();
  let dispatchedEmails = [];

  const sender = async (subject, text, html) => {
    dispatchedEmails.push({ subject, text });
    return true;
  };

  const payload = {
    error_name: "DatabaseDeadlock",
    error_message: "Deadlock detected in session write",
    severity: "CRITICAL",
    context: { path: "/api/sessions/sync" },
  };

  // First call -> Should dispatch
  const res1 = await dispatchCriticalErrorAlert(payload, {
    cooldownMs: 5000,
    customSender: sender,
  });
  assert.equal(res1.dispatched, true);
  assert.equal(res1.suppressed, false);
  assert.equal(dispatchedEmails.length, 1);

  // Second call immediately -> Should be suppressed by cooldown
  const res2 = await dispatchCriticalErrorAlert(payload, {
    cooldownMs: 5000,
    customSender: sender,
  });
  assert.equal(res2.dispatched, false);
  assert.equal(res2.suppressed, true);
  assert.equal(res2.suppressed_count, 1);
  assert.equal(dispatchedEmails.length, 1); // No new email sent

  // Third call -> Still suppressed, count increases
  const res3 = await dispatchCriticalErrorAlert(payload, {
    cooldownMs: 5000,
    customSender: sender,
  });
  assert.equal(res3.suppressed, true);
  assert.equal(res3.suppressed_count, 2);

  // After cooldown expires -> Should dispatch again mentioning suppressed count
  const res4 = await dispatchCriticalErrorAlert(payload, {
    cooldownMs: 0, // Expire cooldown immediately
    customSender: sender,
  });
  assert.equal(res4.dispatched, true);
  assert.equal(res4.suppressed, false);
  assert.equal(res4.suppressed_count, 2); // Dispatched with note about the 2 suppressed items
  assert.equal(dispatchedEmails.length, 2);
  assert.ok(dispatchedEmails[1].text.includes("2 duplicate occurrences were suppressed"));
});

// ============================================================================
// DEV-54: Business Owner Analytics Dashboard (Cross-Tenant) Tests
// ============================================================================

test("DEV-54: BusinessDashboardService.getMetrics returns full business overview", async () => {
  const repo = new FakeBusinessDashboardRepository();
  const service = new BusinessDashboardService(repo);

  const data = await service.getMetrics();
  assert.ok(data.overview);
  assert.equal(data.overview.total_tenants, 25);
  assert.equal(data.overview.active_tenants, 15);
  assert.equal(data.overview.mrr_egp, 4500);
  assert.equal(data.overview.whatsapp.total_sent, 3400);
  assert.equal(data.overview.whatsapp.estimated_cost_egp, 170);
  assert.equal(data.subscription_breakdown.active, 15);
  assert.equal(data.at_risk_tenants.length, 1);
  assert.equal(data.at_risk_tenants[0].risk_factor, "trial_expiring_soon");
});

test("DEV-54: GET /api/business-dashboard/metrics strictly returns 401 when unauthenticated", async () => {
  const res = await fetch(`${baseUrl}/api/business-dashboard/metrics`);
  assert.equal(res.status, 401);
});

test("DEV-54: renderBusinessOwnerDashboard produces valid Arabic HTML with KPI cards", () => {
  const html = renderBusinessOwnerDashboard();
  assert.ok(html.includes("لوحة تحكم المؤسس"));
  assert.ok(html.includes("الإيراد الشهري التقديري"));
  assert.ok(html.includes("رسائل الواتساب"));
  assert.ok(html.includes("إشارات خطر الإلغاء"));
  assert.ok(html.includes("توزيع الاشتراكات"));
});

// ============================================================================
// DEV-55: Website/Product Behavior Tracking Integration Tests
// ============================================================================

test("DEV-55: sanitizeTelemetryProperties strictly redacts passwords, tokens, and secrets", () => {
  const dirty = {
    step: 2,
    role: "teacher",
    password: "SuperSecretPassword123!",
    token: "jwt.bearer.token",
    nested: {
      api_key: "sk_live_12345",
      safeField: "landing_hero_click",
    },
  };

  const clean = sanitizeTelemetryProperties(dirty);
  assert.equal(clean.step, 2);
  assert.equal(clean.role, "teacher");
  assert.equal(clean.password, "[REDACTED]");
  assert.equal(clean.token, "[REDACTED]");
  assert.equal(clean.nested.api_key, "[REDACTED]");
  assert.equal(clean.nested.safeField, "landing_hero_click");
});

test("DEV-55: TelemetryService.trackEvents stores sanitized events and handles empty batch", async () => {
  const repo = new FakeTelemetryRepository();
  const service = new TelemetryService(repo);

  const res1 = await service.trackEvents("tenant-100", [
    { event_name: "signup_started", properties: { step: 1 } },
    { event_name: "whatsapp_connect", properties: { status: "pairing_code_requested" } },
  ]);

  assert.equal(res1.recorded_count, 2);
  assert.equal(repo.recorded.length, 2);
  assert.equal(repo.recorded[0].event_name, "signup_started");
  assert.equal(repo.recorded[0].tenant_id, "tenant-100");

  const res2 = await service.trackEvents("tenant-100", []);
  assert.equal(res2.recorded_count, 0);
});

test("DEV-55: POST /api/telemetry/events returns 404 FEATURE_DISABLED when flag is off", async () => {
  const res = await fetch(`${baseUrl}/api/telemetry/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: [{ event_name: "page_view", page_path: "/login" }],
    }),
  });

  // Since FEATURE_BEHAVIOR_TRACKING is disabled by default in test/prod
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.error.code, "FEATURE_DISABLED");
});

test("DEV-55: Client analytics adapter exposes all core funnel tracking methods", () => {
  assert.equal(typeof analytics.track, "function");
  assert.equal(typeof analytics.trackPageView, "function");
  assert.equal(typeof analytics.trackSignupStarted, "function");
  assert.equal(typeof analytics.trackSignupCompleted, "function");
  assert.equal(typeof analytics.trackWhatsAppConnect, "function");
  assert.equal(typeof analytics.trackSessionAction, "function");
});

// ============================================================================
// DEV-56: Teacher Calendar (Daily / Weekly / Monthly) Tests
// ============================================================================

test("DEV-56: SessionsService.getCalendarSessions queries date range correctly", async () => {
  const repo = new MockSessionsRepo();
  const service = new SessionsService(repo);

  // In range
  const sessions = await service.getCalendarSessions("tenant-abc", "2026-09-01", "2026-09-15");
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, "sess-101");
  assert.equal(sessions[0].groups.name, "مجموعة الصف الثالث الثانوي");

  // Out of range
  const emptySessions = await service.getCalendarSessions("tenant-abc", "2026-09-15", "2026-09-20");
  assert.equal(emptySessions.length, 0);

  // Different tenant
  const wrongTenant = await service.getCalendarSessions("tenant-xyz", "2026-09-01", "2026-09-15");
  assert.equal(wrongTenant.length, 0);
});

test("DEV-56: renderTeacherCalendar generates Arabic RTL calendar with all view modes and status badges", () => {
  // 1. Weekly view (default)
  const weekHtml = renderTeacherCalendar({ view: "week" });
  assert.ok(weekHtml.includes("جدول الحصص والتقويم الأكاديمي"));
  assert.ok(weekHtml.includes("السبت"));
  assert.ok(weekHtml.includes("الأحد"));
  assert.ok(weekHtml.includes("الجمعة"));
  assert.ok(weekHtml.includes("🟢 جارية"));
  assert.ok(weekHtml.includes("🏁 منتهية"));
  assert.ok(weekHtml.includes("🕒 مجدولة"));
  assert.ok(weekHtml.includes("❌ ملغاة"));
  assert.ok(weekHtml.includes("📅 مؤجلة"));
  assert.ok(weekHtml.includes("⭐ إضافية"));

  // 2. Daily view
  const dayHtml = renderTeacherCalendar({ view: "day" });
  assert.ok(dayHtml.includes("حصص اليوم"));
  assert.ok(dayHtml.includes("عرض الحصة"));

  // 3. Monthly view
  const monthHtml = renderTeacherCalendar({ view: "month" });
  assert.ok(monthHtml.includes("تقويم الشهر (سبتمبر 2026)"));
  assert.ok(monthHtml.includes("السبت"));
});

test("DEV-56: GET /api/sessions/calendar strictly returns 401 when unauthenticated", async () => {
  const res = await fetch(`${baseUrl}/api/sessions/calendar?from=2026-09-01&to=2026-09-15`);
  assert.equal(res.status, 401);
});

test("DEV-56: requireFeatureFlag('teacherCalendar') rejects with 404 FEATURE_DISABLED when flag is off", async () => {
  const { requireFeatureFlag } = await import("../dist/shared/middleware/featureFlags.js");
  const middleware = requireFeatureFlag("teacherCalendar");
  let statusSent = 0;
  let jsonSent = null;
  const res = {
    status: (code) => {
      statusSent = code;
      return {
        json: (body) => {
          jsonSent = body;
        },
      };
    },
  };
  let nextCalled = false;
  middleware({}, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(statusSent, 404);
  assert.equal(jsonSent?.error?.code, "FEATURE_DISABLED");
});

