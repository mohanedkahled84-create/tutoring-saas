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

  async getMonthlySessionFinancials(tenantId, fromDate, toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const filteredSessions = this.sessions.filter(s => {
      const d = new Date(s.session_date);
      return d >= from && d <= to;
    });

    return filteredSessions.map(session => {
      const group = this.groups.find(g => g.id === session.group_id) || {};
      const attendance = this.attendees.filter(a => a.session_id === session.id);
      return { session, group, attendance };
    });
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
  // Makeup session tests
  assert.equal(evaluateNotificationDecision(true, null, true), "none");
  assert.equal(evaluateNotificationDecision(true, "حصة تعويضية", false), "none");
  assert.equal(evaluateNotificationDecision(true, "حصة تعويضية", true), "none");
  assert.equal(evaluateNotificationDecision(false, null, true), "none");
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

test("DEV-64: SessionsService.generateReceipt calculates revenue split for no_center (private lessons)", async () => {
  const fakeRepo = new FakeSessionsRepository({
    sessions: [{ id: "sess-no-center", group_id: "grp-nc", session_number: 1, session_date: "2026-09-01" }],
    groups: [{ id: "grp-nc", name: "Private Chemistry Group", center_name: "", price: 150, billing_model: "no_center" }],
    attendees: [
      { session_id: "sess-no-center", attended: true, students: { name: "S1" } },
      { session_id: "sess-no-center", attended: true, students: { name: "S2" } },
      { session_id: "sess-no-center", attended: true, students: { name: "S3" } }, // Total 450 EGP
    ],
  });

  const service = new SessionsService(fakeRepo);
  const result = await service.generateReceipt("tenant-1", "sess-no-center", {
    send_via_whatsapp: false,
  });

  assert.equal(result.summary.total_revenue, 450);
  assert.equal(result.summary.center_share, 0); // 0% center share
  assert.equal(result.summary.teacher_share, 450); // 100% teacher share
  assert.ok(result.formatted_receipt.includes("بدون سنتر (صافي المعلم 100%)"));
  assert.ok(result.formatted_receipt.includes("درس خاص / منزلي (بدون سنتر)"));
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

test("DEV-ACTUAL-EARNINGS: getMonthlyActualEarnings calculates realized money from attendance with exemptions & overrides", async () => {
  const fakeRepo = new FakeSessionsRepository({
    sessions: [
      {
        id: "sess-sep-1",
        group_id: "grp-pct",
        session_number: 1,
        session_date: "2026-09-05",
        status: "ended",
      },
      {
        id: "sess-sep-2",
        group_id: "grp-rent",
        session_number: 2,
        session_date: "2026-09-12",
        status: "ended",
      },
    ],
    groups: [
      {
        id: "grp-pct",
        name: "Physics Group",
        center_name: "Al-Amal Center",
        price: 100,
        billing_model: "percentage",
        center_cut_percentage: 20,
      },
      {
        id: "grp-rent",
        name: "Math Group",
        center_name: "Al-Nour Center",
        price: 150,
        billing_model: "fixed_rent",
        fixed_rent_amount: 250,
      },
    ],
    attendees: [
      // sess-sep-1:
      // student 1: standard price 100
      { session_id: "sess-sep-1", attended: true, students: { id: "s1", exempt: false, fee_override: null } },
      // student 2: fee override 75
      { session_id: "sess-sep-1", attended: true, students: { id: "s2", exempt: false, fee_override: 75 } },
      // student 3: exempt (0)
      { session_id: "sess-sep-1", attended: true, students: { id: "s3", exempt: true, fee_override: null } },
      // student 4: absent (does not pay)
      { session_id: "sess-sep-1", attended: false, students: { id: "s4", exempt: false, fee_override: null } },

      // sess-sep-2:
      // 3 students present at 150 = 450 total revenue. Fixed rent = 250. Teacher share = 200.
      { session_id: "sess-sep-2", attended: true, students: { id: "s5", exempt: false, fee_override: null } },
      { session_id: "sess-sep-2", attended: true, students: { id: "s6", exempt: false, fee_override: null } },
      { session_id: "sess-sep-2", attended: true, students: { id: "s7", exempt: false, fee_override: null } },
    ],
  });

  const service = new SessionsService(fakeRepo);
  const result = await service.getMonthlyActualEarnings("tenant-1", 9, 2026);

  assert.equal(result.period, "2026-09");
  assert.equal(result.month, 9);
  assert.equal(result.year, 2026);
  assert.equal(result.completed_sessions_count, 2);
  assert.equal(result.total_attended_students, 6);

  // Sess 1: revenue = 100 + 75 + 0 = 175. Center cut = 20% of 175 = 35. Teacher share = 140.
  const s1 = result.sessions.find(s => s.session_id === "sess-sep-1");
  assert.ok(s1);
  assert.equal(s1.total_revenue, 175);
  assert.equal(s1.center_share, 35);
  assert.equal(s1.teacher_share, 140);
  assert.equal(s1.present_count, 3);
  assert.equal(s1.absent_count, 1);
  assert.equal(s1.exempt_count, 1);

  // Sess 2: revenue = 150 * 3 = 450. Fixed rent = 250. Teacher share = 200.
  const s2 = result.sessions.find(s => s.session_id === "sess-sep-2");
  assert.ok(s2);
  assert.equal(s2.total_revenue, 450);
  assert.equal(s2.center_share, 250);
  assert.equal(s2.teacher_share, 200);
  assert.equal(s2.present_count, 3);

  // Monthly totals:
  // Actual Revenue: 175 + 450 = 625
  // Actual Center Cut: 35 + 250 = 285
  // Actual Teacher Net: 140 + 200 = 340
  assert.equal(result.actual_revenue, 625);
  assert.equal(result.actual_center_cut, 285);
  assert.equal(result.actual_teacher_net, 340);
});

test("DEV-ACTUAL-EARNINGS: getMonthlyActualEarnings handles no_center and fixed_per_student billing models", async () => {
  const fakeRepo = new FakeSessionsRepository({
    sessions: [
      {
        id: "sess-nc",
        group_id: "grp-nc",
        session_number: 1,
        session_date: "2026-09-03",
        status: "ended",
      },
      {
        id: "sess-fps",
        group_id: "grp-fps",
        session_number: 1,
        session_date: "2026-09-04",
        status: "ended",
      },
    ],
    groups: [
      {
        id: "grp-nc",
        name: "Private Lessons",
        price: 200,
        billing_model: "no_center",
      },
      {
        id: "grp-fps",
        name: "Center Group FPS",
        price: 120,
        billing_model: "fixed_per_student",
        fixed_per_student_amount: 30,
      },
    ],
    attendees: [
      // Private session: 2 present -> 400 rev, 0 center cut, 400 teacher
      { session_id: "sess-nc", attended: true, students: { id: "s1" } },
      { session_id: "sess-nc", attended: true, students: { id: "s2" } },

      // Fixed per student: 4 present -> 480 rev, center cut = 4 * 30 = 120, teacher = 360
      { session_id: "sess-fps", attended: true, students: { id: "s3" } },
      { session_id: "sess-fps", attended: true, students: { id: "s4" } },
      { session_id: "sess-fps", attended: true, students: { id: "s5" } },
      { session_id: "sess-fps", attended: true, students: { id: "s6" } },
    ],
  });

  const service = new SessionsService(fakeRepo);
  const result = await service.getMonthlyActualEarnings("tenant-1", 9, 2026);

  assert.equal(result.actual_revenue, 400 + 480); // 880
  assert.equal(result.actual_center_cut, 0 + 120); // 120
  assert.equal(result.actual_teacher_net, 400 + 360); // 760
  assert.equal(result.completed_sessions_count, 2);
  assert.equal(result.total_attended_students, 6);
});

