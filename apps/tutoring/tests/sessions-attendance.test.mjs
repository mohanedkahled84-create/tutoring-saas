import test from "node:test";
import assert from "node:assert/strict";
import { SessionsService } from "../dist/features/sessions/service.js";
import {
  AttendanceService,
  evaluateNotificationDecision,
} from "../dist/features/attendance/service.js";

/**
 * In-Memory Fake Sessions Repository
 */
class FakeSessionsRepository {
  constructor(initialData = {}) {
    this.sessions = initialData.sessions || [];
    this.groups = initialData.groups || [];
    this.attendees = initialData.attendees || [];
    this.quizzes = initialData.quizzes || [];
    this.receiptLogs = [];
  }

  async createSession(tenantId, input) {
    const s = {
      id: `sess-${this.sessions.length + 1}`,
      tenant_id: tenantId,
      group_id: input.group_id,
      session_number: input.session_number,
      session_date: input.session_date,
      created_at: new Date().toISOString(),
    };
    this.sessions.push(s);
    return s;
  }

  async getSessionWithDetails(sessionId) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    return {
      session,
      attendance: this.attendees.filter((a) => a.session_id === sessionId),
      quiz_scores: this.quizzes.filter((q) => q.session_id === sessionId),
    };
  }

  async getSessionWithGroup(sessionId) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    const group = this.groups.find((g) => g.id === session.group_id) || {};
    return { session, group };
  }

  async getAttendedStudentsForSession(sessionId) {
    return this.attendees.filter((a) => a.session_id === sessionId && a.attended);
  }

  async getAllAttendanceWithStudents(sessionId) {
    return this.attendees.filter((a) => a.session_id === sessionId);
  }

  async upsertQuizScore(tenantId, sessionId, studentId, score, maxScore) {
    const record = {
      id: `quiz-${this.quizzes.length + 1}`,
      tenant_id: tenantId,
      session_id: sessionId,
      student_id: studentId,
      score,
      max_score: maxScore,
    };
    this.quizzes.push(record);
    return record;
  }

  async getQuizScoresForSession(sessionId) {
    return this.quizzes.filter((q) => q.session_id === sessionId);
  }

  async logReceiptMessage(tenantId, idempotencyKey, recipientType, recipientPhone, formattedReceipt) {
    const id = `msg-${this.receiptLogs.length + 1}`;
    this.receiptLogs.push({ id, tenantId, idempotencyKey, recipientType, recipientPhone, formattedReceipt });
    return id;
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

  async getStudentsByIds(tenantId, studentIds) {
    return this.students
      .filter((s) => s.tenant_id === tenantId && studentIds.includes(s.id))
      .map((s) => ({ id: s.id, name: s.name, parent_phone: s.parent_phone }));
  }

  async getAttendanceForSession(sessionId) {
    return this.attendance.filter((a) => a.session_id === sessionId);
  }

  async getMessageLogsForTenant(tenantId) {
    return this.messageLogs.filter((m) => m.tenant_id === tenantId);
  }
}

// ========================================================
// DEV-64: Sessions & Attendance Domain Logic Unit Tests
// ========================================================

test("DEV-64: evaluateNotificationDecision classifies correctly", () => {
  assert.equal(evaluateNotificationDecision(false), "attendance_absent");
  assert.equal(evaluateNotificationDecision(true, "ممتاز اليوم"), "attendance_present_comment");
  assert.equal(evaluateNotificationDecision(true, ""), "none");
  assert.equal(evaluateNotificationDecision(true, null), "none");
});

test("DEV-64: SessionsService.calculateFinancialSummary computes revenue, exemptions, and overrides", () => {
  const fakeRepo = new FakeSessionsRepository();
  const service = new SessionsService(fakeRepo);

  const group = {
    id: "grp-1",
    name: "Physics Group A",
    price: 100,
    billing_model: "percentage",
  };

  const attendees = [
    // Regular: 100 EGP
    { id: "att-1", student_id: "s1", attended: true, students: { id: "s1", name: "Ahmed" } },
    // Override: 70 EGP
    { id: "att-2", student_id: "s2", attended: true, students: { id: "s2", name: "Mohamed", fee_override: 70 } },
    // Exempt: 0 EGP
    { id: "att-3", student_id: "s3", attended: true, students: { id: "s3", name: "Sara", exempt: true } },
    // Make-up: 100 EGP
    { id: "att-4", student_id: "s4", attended: true, is_makeup: true, students: { id: "s4", name: "Kareem" } },
  ];

  const summary = service.calculateFinancialSummary("sess-1", group, attendees);

  assert.equal(summary.financials.attendee_count, 4);
  assert.equal(summary.financials.regular_count, 2);
  assert.equal(summary.financials.overridden_count, 1);
  assert.equal(summary.financials.exempt_count, 1);
  assert.equal(summary.financials.makeup_count, 1);
  assert.equal(summary.financials.total_revenue, 270); // 100 + 70 + 0 + 100 = 270 EGP
});

test("DEV-64: SessionsService.generateReceipt calculates revenue split for fixed_rent", async () => {
  const fakeRepo = new FakeSessionsRepository({
    sessions: [{ id: "sess-1", group_id: "grp-1", session_number: 1, session_date: "2026-09-01" }],
    groups: [{ id: "grp-1", name: "Math Class", center_name: "Smart Center", price: 100, billing_model: "fixed_rent", fixed_rent_amount: 300 }],
    attendees: [
      { session_id: "sess-1", attended: true, students: { name: "S1" } },
      { session_id: "sess-1", attended: true, students: { name: "S2" } },
      { session_id: "sess-1", attended: true, students: { name: "S3" } },
      { session_id: "sess-1", attended: true, students: { name: "S4" } },
      { session_id: "sess-1", attended: true, students: { name: "S5" } }, // Total 500 EGP
    ],
  });

  const service = new SessionsService(fakeRepo);
  const result = await service.generateReceipt("tenant-1", "sess-1", {
    send_via_whatsapp: false,
  });

  assert.equal(result.summary.total_revenue, 500);
  assert.equal(result.summary.center_share, 300); // Fixed 300 rent
  assert.equal(result.summary.teacher_share, 200); // Remainder 200
  assert.ok(result.formatted_receipt.includes("Smart Center"));
});

test("DEV-64: AttendanceService.scanStudent prevents duplicate check-in", async () => {
  const fakeRepo = new FakeAttendanceRepository({
    students: [{ id: "stu-1", name: "Ziad", student_code: "Z10", tenant_id: "tenant-1" }],
  });

  const service = new AttendanceService(fakeRepo);

  // First scan
  const firstScan = await service.scanStudent("tenant-1", "sess-1", { student_id: "stu-1" });
  assert.equal(firstScan.already_recorded, false);
  assert.equal(firstScan.student.name, "Ziad");

  // Second scan
  const secondScan = await service.scanStudent("tenant-1", "sess-1", { student_id: "stu-1" });
  assert.equal(secondScan.already_recorded, true);
  assert.ok(secondScan.message.includes("Student already recorded"));
  assert.equal(fakeRepo.attendance.length, 1); // Row was not duplicated!
});

test("DEV-64: AttendanceService.syncOfflineBatch handles mixed new and duplicate items", async () => {
  const fakeRepo = new FakeAttendanceRepository({
    attendance: [
      {
        id: "att-1",
        idempotency_key: "tenant-1:stu-1:sess-1",
        created_at: "2026-09-01T10:00:00Z",
      },
    ],
  });

  const service = new AttendanceService(fakeRepo);
  const result = await service.syncOfflineBatch("tenant-1", "sess-1", [
    { student_id: "stu-1", attended: true, client_timestamp: "2026-09-01T10:05:00Z" },
    { student_id: "stu-2", attended: true, client_timestamp: "2026-09-01T10:06:00Z" },
  ]);

  assert.equal(result.total, 2);
  assert.equal(result.already_recorded_count, 1);
  assert.equal(result.synced_count, 1);
  assert.equal(result.failed_count, 0);
});
