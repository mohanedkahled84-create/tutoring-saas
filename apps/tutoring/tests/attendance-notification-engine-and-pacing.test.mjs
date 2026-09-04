import test from "node:test";
import assert from "node:assert/strict";
import { SessionsService } from "../dist/features/sessions/service.js";
import { AttendanceService, evaluateNotificationDecision } from "../dist/features/attendance/service.js";
import {
  WhatsAppNotificationsService,
  getDailyQuotaStatus,
  incrementTenantDailyCount,
  resetTenantDailyCount,
  recordHealthError,
  recordHealthSuccess,
} from "../dist/features/whatsapp-notifications/service.js";

/**
 * In-Memory Fake Sessions Repository
 */
class FakeSessionsRepository {
  constructor(initialData = {}) {
    this.sessions = initialData.sessions || [];
    this.groups = initialData.groups || [];
  }

  async createSession(tenantId, input) {
    const s = {
      id: `sess-${this.sessions.length + 1}`,
      tenant_id: tenantId,
      group_id: input.group_id,
      session_number: input.session_number,
      session_date: input.session_date,
      status: "in_progress",
      created_at: new Date().toISOString(),
    };
    this.sessions.push(s);
    return s;
  }

  async getSessionWithGroup(sessionId) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    const group = this.groups.find((g) => g.id === session.group_id) || {};
    return { session, group };
  }

  async updateSessionStatus(sessionId, status, endedAt) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    session.status = status;
    if (endedAt !== undefined) session.ended_at = endedAt;
    return session;
  }
}

/**
 * In-Memory Fake Attendance Repository
 */
class FakeAttendanceRepository {
  constructor(initialData = {}) {
    this.students = initialData.students || [];
    this.attendance = initialData.attendance || [];
    this.messageLogs = initialData.messageLogs || [];
  }

  async findStudent(tenantId, studentId, studentCode) {
    return (
      this.students.find(
        (s) =>
          s.tenant_id === tenantId &&
          (studentId ? s.id === studentId : s.student_code === studentCode)
      ) || null
    );
  }

  async findAttendanceByKey(key) {
    return this.attendance.find((a) => a.idempotency_key === key) || null;
  }

  async createAttendanceRecord(record) {
    const entry = {
      id: `att-${this.attendance.length + 1}`,
      created_at: new Date().toISOString(),
      ...record,
    };
    this.attendance.push(entry);
    return entry;
  }

  async upsertAttendanceBatch(records) {
    const result = [];
    for (const r of records) {
      const idx = this.attendance.findIndex((a) => a.idempotency_key === r.idempotency_key);
      if (idx >= 0) {
        this.attendance[idx] = { ...this.attendance[idx], ...r };
        result.push(this.attendance[idx]);
      } else {
        const created = { id: `att-${this.attendance.length + 1}`, created_at: new Date().toISOString(), ...r };
        this.attendance.push(created);
        result.push(created);
      }
    }
    return result;
  }

  async getAttendanceForSession(sessionId) {
    return this.attendance.filter((a) => a.session_id === sessionId);
  }

  async getAttendanceWithStudentsForSession(sessionId) {
    return this.attendance
      .filter((a) => a.session_id === sessionId)
      .map((a) => ({
        ...a,
        students: this.students.find((s) => s.id === a.student_id) || null,
      }));
  }

  async updateAttendanceStatus(id, updates) {
    const item = this.attendance.find((a) => a.id === id);
    if (item) {
      Object.assign(item, updates);
    }
  }

  async getMessageLogsForTenant(tenantId) {
    return this.messageLogs.filter((m) => m.tenant_id === tenantId);
  }
}

/**
 * Fake WhatsApp Repository for Dispatcher
 */
class FakeWhatsAppRepository {
  constructor() {
    this.dispatchedKeys = new Set();
  }
  async isMessageDispatched(key) {
    return this.dispatchedKeys.has(key);
  }
  async getTemplates() { return []; }
  async upsertTemplate(t) { return t; }
  async getConnectionStatus() {
    return {
      status: "connected",
      phone_number: "+201012345678",
      gateway: "evolution",
      latency_ms: 120,
      daily_quota: { used: 0, limit: 500, safety_score: "100%" },
    };
  }
}

// ============================================================================
// Unit Tests: DEV-12, DEV-13, and DEV-36
// ============================================================================

test("DEV-13: SessionsService.endSession finalizes session status and records ended_at", async () => {
  const fakeSessionsRepo = new FakeSessionsRepository({
    sessions: [
      { id: "sess-101", group_id: "grp-1", session_number: 1, session_date: "2026-09-05", status: "in_progress" },
    ],
    groups: [{ id: "grp-1", name: "Science G1" }],
  });

  const service = new SessionsService(fakeSessionsRepo);
  const result = await service.endSession("tenant-1", "sess-101");

  assert.equal(result.status, "ended");
  assert.ok(result.ended_at);
  assert.equal(fakeSessionsRepo.sessions[0].status, "ended");
  assert.equal(result.message, "Session ended successfully. Attendance finalized.");

  // Reject non-existent session
  await assert.rejects(
    () => service.endSession("tenant-1", "sess-unknown"),
    /SESSION_NOT_FOUND/
  );
});

test("DEV-13: Attendance scanning and batch input do NOT trigger automatic WhatsApp sending", async () => {
  const fakeAttendanceRepo = new FakeAttendanceRepository({
    students: [
      { id: "s1", tenant_id: "t1", name: "Omar", parent_phone: "+201011111111", student_code: "1001" },
    ],
  });

  const attendanceService = new AttendanceService(fakeAttendanceRepo);

  // Scan student with comment
  const scanResult = await attendanceService.scanStudent("t1", "sess-1", {
    student_id: "s1",
    comment: "ممتاز اليوم",
  });

  assert.equal(scanResult.already_recorded, false);
  // Attendance record stored with sent: false
  assert.equal(fakeAttendanceRepo.attendance[0].sent, false);
  assert.equal(fakeAttendanceRepo.attendance[0].comment, "ممتاز اليوم");
});

test("DEV-13: dispatchSessionMessages sends ONLY eligible candidates (absent + present-with-comment)", async () => {
  const fakeAttendanceRepo = new FakeAttendanceRepository({
    students: [
      { id: "s1", tenant_id: "t1", name: "Ahmed", parent_phone: "+201011111111" },
      { id: "s2", tenant_id: "t1", name: "Mona", parent_phone: "+201022222222" },
      { id: "s3", tenant_id: "t1", name: "Ali", parent_phone: "+201033333333" },
      { id: "s4", tenant_id: "t1", name: "Sara", parent_phone: "+201044444444" },
    ],
    attendance: [
      // 1. Absent -> ELIGIBLE
      { id: "att-1", tenant_id: "t1", session_id: "sess-1", student_id: "s1", attended: false, sent: false, idempotency_key: "t1:s1:sess-1" },
      // 2. Present with comment -> ELIGIBLE
      { id: "att-2", tenant_id: "t1", session_id: "sess-1", student_id: "s2", attended: true, comment: "انتباه ممتاز", sent: false, idempotency_key: "t1:s2:sess-1" },
      // 3. Present WITHOUT comment -> SKIPPED
      { id: "att-3", tenant_id: "t1", session_id: "sess-1", student_id: "s3", attended: true, comment: null, sent: false, idempotency_key: "t1:s3:sess-1" },
      // 4. Absent but ALREADY SENT -> SKIPPED (idempotent)
      { id: "att-4", tenant_id: "t1", session_id: "sess-1", student_id: "s4", attended: false, sent: true, idempotency_key: "t1:s4:sess-1" },
    ],
  });

  const fakeWaRepo = new FakeWhatsAppRepository();
  const whatsAppService = new WhatsAppNotificationsService(fakeWaRepo);
  const attendanceService = new AttendanceService(fakeAttendanceRepo);

  const result = await attendanceService.dispatchSessionMessages("t1", "sess-1", whatsAppService, {
    pacingDelayMs: 0,
  });

  assert.equal(result.total_students, 4);
  assert.equal(result.eligible_count, 2); // Only s1 and s2
  assert.equal(result.dispatched_count, 2);
  assert.equal(result.skipped_count, 2); // s3 (no comment) and s4 (already sent)

  // Check that records in repository were updated to sent: true
  const s1Att = fakeAttendanceRepo.attendance.find((a) => a.id === "att-1");
  const s2Att = fakeAttendanceRepo.attendance.find((a) => a.id === "att-2");
  const s3Att = fakeAttendanceRepo.attendance.find((a) => a.id === "att-3");

  assert.equal(s1Att.sent, true);
  assert.equal(s1Att.wa_status, "sent");
  assert.equal(s2Att.sent, true);
  assert.equal(s2Att.wa_status, "sent");
  assert.equal(s3Att.sent, false); // untouched
});

test("DEV-13 (DEV-ATN.3): resendStudentMessage allows manual resend for single student", async () => {
  const fakeAttendanceRepo = new FakeAttendanceRepository({
    students: [
      { id: "s-resend", tenant_id: "t1", name: "Kareem", parent_phone: "+201099999999" },
    ],
    attendance: [
      { id: "att-resend", tenant_id: "t1", session_id: "sess-1", student_id: "s-resend", attended: false, sent: false, idempotency_key: "t1:s-resend:sess-1" },
    ],
  });

  const fakeWaRepo = new FakeWhatsAppRepository();
  const whatsAppService = new WhatsAppNotificationsService(fakeWaRepo);
  const attendanceService = new AttendanceService(fakeAttendanceRepo);

  const resendResult = await attendanceService.resendStudentMessage("t1", "sess-1", "s-resend", whatsAppService);

  assert.equal(resendResult.success, true);
  assert.equal(resendResult.student_name, "Kareem");
  assert.ok(resendResult.resend_idempotency_key.includes("resend:"));
  assert.equal(fakeAttendanceRepo.attendance[0].sent, true);
  assert.equal(fakeAttendanceRepo.attendance[0].wa_status, "sent");

  // Rejects if student not found
  await assert.rejects(
    () => attendanceService.resendStudentMessage("t1", "sess-1", "s-ghost", whatsAppService),
    /STUDENT_NOT_FOUND/
  );
});

test("DEV-36: batchSendWithPacing enforces daily volume cap and warns at 80%", async () => {
  resetTenantDailyCount("tenant-quota-test");

  const fakeWaRepo = new FakeWhatsAppRepository();
  const whatsAppService = new WhatsAppNotificationsService(fakeWaRepo);

  // Set low dailyCap of 3 for testing
  const testCap = 3;

  const items = [
    { student_id: "st-1", student_name: "T1", parent_phone: "+201011111111", session_id: "sess-q", attended: false, idempotency_key: "k1" },
    { student_id: "st-2", student_name: "T2", parent_phone: "+201022222222", session_id: "sess-q", attended: false, idempotency_key: "k2" },
    { student_id: "st-3", student_name: "T3", parent_phone: "+201033333333", session_id: "sess-q", attended: false, idempotency_key: "k3" },
    { student_id: "st-4", student_name: "T4", parent_phone: "+201044444444", session_id: "sess-q", attended: false, idempotency_key: "k4" },
  ];

  const batchResult = await whatsAppService.batchSendWithPacing("tenant-quota-test", items, {
    pacingDelayMs: 0,
    dailyCap: testCap,
  });

  assert.equal(batchResult.sent_count, 3);
  assert.equal(batchResult.skipped_count, 1);
  assert.equal(batchResult.results[3].status, "skipped_daily_cap");
  assert.ok(batchResult.results[3].error.includes("Daily volume cap"));

  // Check quota status reflects cap reached
  const quota = getDailyQuotaStatus("tenant-quota-test", testCap);
  assert.equal(quota.sent_today, 3);
  assert.equal(quota.cap_reached, true);
  assert.equal(quota.remaining, 0);
  assert.ok(quota.warning);

  resetTenantDailyCount("tenant-quota-test");
});

test("DEV-36: batchSendWithPacing respects circuit breaker when paused", async () => {
  const tenantId = "tenant-circuit-pacing";
  resetTenantDailyCount(tenantId);
  recordHealthSuccess(tenantId);

  // Trigger 3 errors to open circuit breaker
  recordHealthError(tenantId, "disconnect");
  recordHealthError(tenantId, "disconnect");
  recordHealthError(tenantId, "disconnect");

  const fakeWaRepo = new FakeWhatsAppRepository();
  const whatsAppService = new WhatsAppNotificationsService(fakeWaRepo);

  const items = [
    { student_id: "s-cb-1", student_name: "CB1", parent_phone: "+201011111111", session_id: "sess-cb", attended: false, idempotency_key: "cb-1" },
  ];

  const result = await whatsAppService.batchSendWithPacing(tenantId, items, { pacingDelayMs: 0 });

  assert.equal(result.sent_count, 0);
  assert.equal(result.skipped_count, 1);
  assert.equal(result.results[0].status, "skipped_circuit_open");
  assert.ok(result.results[0].error.includes("Circuit breaker is paused"));
});
