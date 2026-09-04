import test from "node:test";
import assert from "node:assert/strict";
import { RiskWatchlistService } from "../dist/features/risk-watchlist/service.js";

/**
 * In-Memory Fake Repository implementing IRiskWatchlistRepository
 * Proves Rule 1: Zero Supabase dependencies in domain business logic.
 */
class FakeRiskWatchlistRepository {
  constructor(initialData = {}) {
    this.students = initialData.students || [];
    this.sessions = initialData.sessions || [];
    this.attendance = initialData.attendance || [];
    this.quizzes = initialData.quizzes || [];
    this.messageLogs = [];
  }

  async getStudents(tenantId) {
    return this.students.filter((s) => s.tenant_id === tenantId);
  }

  async getRecentSessions(tenantId, groupId) {
    let result = this.sessions.filter((s) => s.tenant_id === tenantId);
    if (groupId) {
      result = result.filter((s) => s.group_id === groupId);
    }
    return result;
  }

  async getAttendanceForSessions(sessionIds) {
    return this.attendance.filter((a) => sessionIds.includes(a.session_id));
  }

  async getQuizScoresForStudents(studentIds) {
    return this.quizzes.filter((q) => studentIds.includes(q.student_id));
  }

  async getStudentById(tenantId, studentId) {
    return (
      this.students.find((s) => s.tenant_id === tenantId && s.id === studentId) || null
    );
  }

  async upsertAlertLog(entry) {
    this.messageLogs.push(entry);
    return { status: entry.status };
  }
}

// ========================================================
// DEV-62: Risk-Watchlist Service & Fake Repository Tests
// ========================================================

test("DEV-62: computeWatchlist returns empty when tenant has no students", async () => {
  const fakeRepo = new FakeRiskWatchlistRepository();
  const service = new RiskWatchlistService(fakeRepo);
  const result = await service.computeWatchlist("tenant-1");
  assert.deepEqual(result, []);
});

test("DEV-62: computeWatchlist detects absence_warning for 2+ consecutive absences", async () => {
  const fakeRepo = new FakeRiskWatchlistRepository({
    students: [
      {
        id: "stu-1",
        name: "Omar Tarek",
        parent_phone: "01011112222",
        tenant_id: "tenant-1",
      },
    ],
    sessions: [
      { id: "sess-1", session_number: 1, session_date: "2026-09-01", tenant_id: "tenant-1" },
      { id: "sess-2", session_number: 2, session_date: "2026-09-03", tenant_id: "tenant-1" },
    ],
    attendance: [
      {
        id: "att-1",
        session_id: "sess-1",
        student_id: "stu-1",
        attended: false,
        created_at: "2026-09-01T10:00:00Z",
      },
      {
        id: "att-2",
        session_id: "sess-2",
        student_id: "stu-1",
        attended: false,
        created_at: "2026-09-03T10:00:00Z",
      },
    ],
  });

  const service = new RiskWatchlistService(fakeRepo);
  const watchlist = await service.computeWatchlist("tenant-1");

  assert.equal(watchlist.length, 1);
  assert.equal(watchlist[0].student_id, "stu-1");
  assert.equal(watchlist[0].primary_risk, "absence_warning");
  assert.equal(watchlist[0].metrics.consecutive_absences, 2);
  assert.equal(watchlist[0].severity, "medium");
});

test("DEV-62: computeWatchlist detects grade_drop and escalates to high severity if < 30%", async () => {
  const fakeRepo = new FakeRiskWatchlistRepository({
    students: [
      {
        id: "stu-2",
        name: "Farah Ahmed",
        parent_phone: "01033334444",
        tenant_id: "tenant-1",
      },
    ],
    sessions: [
      { id: "sess-1", session_number: 1, session_date: "2026-09-01", tenant_id: "tenant-1" },
    ],
    quizzes: [
      {
        student_id: "stu-2",
        session_id: "sess-1",
        score: 2,
        max_score: 10, // 20%
        created_at: "2026-09-01T10:00:00Z",
      },
    ],
  });

  const service = new RiskWatchlistService(fakeRepo);
  const watchlist = await service.computeWatchlist("tenant-1");

  assert.equal(watchlist.length, 1);
  assert.equal(watchlist[0].primary_risk, "grade_drop");
  assert.equal(watchlist[0].metrics.recent_quiz_avg, 20);
  assert.equal(watchlist[0].severity, "high"); // < 30% triggers high severity
});

test("DEV-62: computeWatchlist detects homework_neglect and ranks high severity first", async () => {
  const fakeRepo = new FakeRiskWatchlistRepository({
    students: [
      {
        id: "stu-hw",
        name: "Youssef Aly",
        parent_phone: "01055556666",
        tenant_id: "tenant-1",
      },
      {
        id: "stu-high",
        name: "Amr Nader",
        parent_phone: "01077778888",
        tenant_id: "tenant-1",
      },
    ],
    sessions: [
      { id: "sess-1", session_number: 1, session_date: "2026-09-01", tenant_id: "tenant-1" },
      { id: "sess-2", session_number: 2, session_date: "2026-09-02", tenant_id: "tenant-1" },
      { id: "sess-3", session_number: 3, session_date: "2026-09-03", tenant_id: "tenant-1" },
    ],
    attendance: [
      // Youssef: 2 missing homeworks -> medium severity
      {
        id: "att-1",
        session_id: "sess-1",
        student_id: "stu-hw",
        attended: true,
        homework_status: "missing",
        created_at: "2026-09-01T10:00:00Z",
      },
      {
        id: "att-2",
        session_id: "sess-2",
        student_id: "stu-hw",
        attended: true,
        homework_status: "missing",
        created_at: "2026-09-02T10:00:00Z",
      },
      // Amr: 3 absences -> high severity
      {
        id: "att-3",
        session_id: "sess-1",
        student_id: "stu-high",
        attended: false,
        created_at: "2026-09-01T10:00:00Z",
      },
      {
        id: "att-4",
        session_id: "sess-2",
        student_id: "stu-high",
        attended: false,
        created_at: "2026-09-02T10:00:00Z",
      },
      {
        id: "att-5",
        session_id: "sess-3",
        student_id: "stu-high",
        attended: false,
        created_at: "2026-09-03T10:00:00Z",
      },
    ],
  });

  const service = new RiskWatchlistService(fakeRepo);
  const watchlist = await service.computeWatchlist("tenant-1");

  assert.equal(watchlist.length, 2);
  // High severity student Amr should come first even though 'Amr' and 'Youssef'
  assert.equal(watchlist[0].student_id, "stu-high");
  assert.equal(watchlist[0].severity, "high");
  assert.equal(watchlist[1].student_id, "stu-hw");
  assert.equal(watchlist[1].severity, "medium");
});

test("DEV-62: queueAlert generates idempotent alert log entry", async () => {
  const fakeRepo = new FakeRiskWatchlistRepository({
    students: [
      {
        id: "stu-1",
        name: "Omar Tarek",
        parent_phone: "01011112222",
        tenant_id: "tenant-1",
      },
    ],
  });

  const service = new RiskWatchlistService(fakeRepo);
  const result = await service.queueAlert("tenant-1", "stu-1", "absence_warning", "Please follow up");

  assert.equal(result.student_id, "stu-1");
  assert.equal(result.alert_type, "absence_warning");
  assert.equal(result.status, "needs_review");
  assert.ok(result.idempotency_key.includes("tenant-1:stu-1:alert:absence_warning:"));
  assert.equal(fakeRepo.messageLogs.length, 1);
});

test("DEV-62: queueAlert throws STUDENT_NOT_FOUND when student does not exist", async () => {
  const fakeRepo = new FakeRiskWatchlistRepository();
  const service = new RiskWatchlistService(fakeRepo);

  await assert.rejects(
    () => service.queueAlert("tenant-1", "non-existent", "absence_warning"),
    {
      message: "STUDENT_NOT_FOUND",
    }
  );
});
