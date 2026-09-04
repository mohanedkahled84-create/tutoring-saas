import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { SessionsService } from "../dist/features/sessions/service.js";
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
