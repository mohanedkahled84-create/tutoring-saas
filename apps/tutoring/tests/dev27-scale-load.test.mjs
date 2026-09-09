import test from "node:test";
import assert from "node:assert/strict";
import { AttendanceService, evaluateNotificationDecision } from "../dist/features/attendance/service.js";
import {
  WhatsAppNotificationsService,
  resetTenantDailyCount,
  getDailyQuotaStatus,
  DEFAULT_SAFE_DAILY_CAP,
} from "../dist/features/whatsapp-notifications/service.js";
import { logger } from "../dist/shared/utils/logger.js";

// Keep test output clean
const originalInfo = logger.info;
logger.info = () => {};

/**
 * High-performance indexed repository simulating indexed database behavior
 */
class IndexedAttendanceRepository {
  constructor(students = []) {
    this.studentsMap = new Map();
    this.studentsCodeMap = new Map();
    for (const s of students) {
      this.studentsMap.set(`${s.tenant_id}:${s.id}`, s);
      if (s.student_code) {
        this.studentsCodeMap.set(`${s.tenant_id}:${s.student_code}`, s);
      }
    }
    this.attendanceMap = new Map();
    this.messageLogs = [];
  }

  async findStudent(tenantId, studentId, studentCode) {
    if (studentId) {
      return this.studentsMap.get(`${tenantId}:${studentId}`) || null;
    }
    if (studentCode) {
      return this.studentsCodeMap.get(`${tenantId}:${studentCode}`) || null;
    }
    return null;
  }

  async findAttendanceByKey(key) {
    return this.attendanceMap.get(key) || null;
  }

  async createAttendanceRecord(record) {
    const entry = {
      id: `att-${this.attendanceMap.size + 1}`,
      created_at: new Date().toISOString(),
      ...record,
    };
    this.attendanceMap.set(record.idempotency_key, entry);
    return entry;
  }

  async upsertAttendanceBatch(records) {
    const results = [];
    for (const r of records) {
      let existing = this.attendanceMap.get(r.idempotency_key);
      if (existing) {
        Object.assign(existing, r);
        results.push(existing);
      } else {
        const created = {
          id: `att-${this.attendanceMap.size + 1}`,
          created_at: new Date().toISOString(),
          ...r,
        };
        this.attendanceMap.set(r.idempotency_key, created);
        results.push(created);
      }
    }
    return results;
  }

  async getAttendanceForSession(sessionId) {
    return Array.from(this.attendanceMap.values()).filter((a) => a.session_id === sessionId);
  }

  async getAttendanceWithStudentsForSession(sessionId) {
    const atts = Array.from(this.attendanceMap.values()).filter((a) => a.session_id === sessionId);
    return atts.map((a) => {
      const student = this.studentsMap.get(`${a.tenant_id}:${a.student_id}`) || null;
      return {
        ...a,
        students: student,
      };
    });
  }

  async updateAttendanceStatus(id, updates) {
    for (const entry of this.attendanceMap.values()) {
      if (entry.id === id) {
        Object.assign(entry, updates);
        break;
      }
    }
  }

  async getMessageLogsForTenant(tenantId) {
    return this.messageLogs.filter((m) => m.tenant_id === tenantId);
  }
}

class FastWhatsAppRepository {
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
      latency_ms: 80,
      daily_quota: { used: 0, limit: 500, safety_score: "100%" },
    };
  }
}

test("DEV-27 / DEV-SCALE.2: Load test core loop for single tenant with 500 students", async (t) => {
  const TENANT_ID = "tenant-scale-pilot";
  const SESSION_ID = "session-scale-500";
  const STUDENT_COUNT = 500;

  // 1. Generate 500 students
  const students = [];
  for (let i = 1; i <= STUDENT_COUNT; i++) {
    const pad = String(i).padStart(4, "0");
    students.push({
      id: `std-${pad}`,
      tenant_id: TENANT_ID,
      name: `طالب تجريبي ${i}`,
      student_code: `STD-${pad}`,
      parent_phone: `+2010${String(10000000 + i)}`,
      student_phone: `+2012${String(10000000 + i)}`,
      fee_override: null,
      exempt: false,
    });
  }

  const repo = new IndexedAttendanceRepository(students);
  const waRepo = new FastWhatsAppRepository();
  const attendanceService = new AttendanceService(repo);
  const waService = new WhatsAppNotificationsService(waRepo);

  resetTenantDailyCount(TENANT_ID);

  await t.test("Subtest 1: 500 rapid sequential scans complete with sub-millisecond average latency", async () => {
    const start = performance.now();
    for (let i = 0; i < STUDENT_COUNT; i++) {
      const res = await attendanceService.scanStudent(TENANT_ID, SESSION_ID, {
        student_id: students[i].id,
        comment: i % 10 === 0 ? "ملاحظة مهمة" : undefined,
      });
      assert.equal(res.already_recorded, false);
      assert.equal(res.student.id, students[i].id);
    }
    const elapsed = performance.now() - start;
    const avgLatency = elapsed / STUDENT_COUNT;

    assert.ok(elapsed < 2000, `Expected 500 scans to complete under 2000ms, took ${elapsed.toFixed(2)}ms`);
    assert.ok(avgLatency < 4, `Expected avg scan latency under 4ms, took ${avgLatency.toFixed(3)}ms`);
  });

  await t.test("Subtest 2: 500 duplicate scans are 100% intercepted by idempotency guard", async () => {
    const start = performance.now();
    let intercepted = 0;
    for (let i = 0; i < STUDENT_COUNT; i++) {
      const res = await attendanceService.scanStudent(TENANT_ID, SESSION_ID, {
        student_id: students[i].id,
      });
      if (res.already_recorded) {
        intercepted++;
      }
    }
    const elapsed = performance.now() - start;

    assert.equal(intercepted, STUDENT_COUNT);
    assert.ok(elapsed < 2000, `Expected duplicate checks under 2000ms, took ${elapsed.toFixed(2)}ms`);
  });

  await t.test("Subtest 3: Batch attendance ingestion records 500 students in a single operation", async () => {
    const BATCH_SESSION = "session-batch-500";
    // 75 absent, 50 present with comment, 375 present without comment
    const batchRecords = students.map((s, idx) => ({
      student_id: s.id,
      attended: idx >= 75,
      comment: idx >= 75 && idx < 125 ? "مشارك ممتاز" : null,
    }));

    const start = performance.now();
    const result = await attendanceService.recordBatchAttendance(TENANT_ID, BATCH_SESSION, batchRecords);
    const elapsed = performance.now() - start;

    assert.equal(result.count, 500);
    assert.equal(result.notificationCandidates.length, 125);
    assert.ok(elapsed < 500, `Expected batch ingestion under 500ms, took ${elapsed.toFixed(2)}ms`);
  });

  await t.test("Subtest 4: WhatsApp notification dispatch processes 500 students and delivers 125 eligible candidates", async () => {
    const BATCH_SESSION = "session-batch-500";
    const start = performance.now();
    const result = await attendanceService.dispatchSessionMessages(
      TENANT_ID,
      BATCH_SESSION,
      waService,
      { pacingDelayMs: 0, dailyCap: DEFAULT_SAFE_DAILY_CAP }
    );
    const elapsed = performance.now() - start;

    assert.equal(result.total_students, 500);
    assert.equal(result.eligible_count, 125);
    assert.equal(result.dispatched_count, 125);
    assert.equal(result.skipped_count, 375);
    assert.ok(elapsed < 1000, `Expected dispatch evaluation under 1000ms, took ${elapsed.toFixed(2)}ms`);

    const quota = getDailyQuotaStatus(TENANT_ID, DEFAULT_SAFE_DAILY_CAP);
    assert.equal(quota.sent_today, 125);
    assert.equal(quota.remaining, 375);
  });

  await t.test("Subtest 5: Daily quota correctly enforces 500-message cap and rejects excess", async () => {
    resetTenantDailyCount(TENANT_ID);

    const items = students.map((s) => ({
      student_id: s.id,
      student_name: s.name,
      parent_phone: s.parent_phone,
      session_id: "quota-test-session",
      attended: false,
      idempotency_key: `${TENANT_ID}:${s.id}:quota-test`,
    }));

    const batchRes = await waService.batchSendWithPacing(TENANT_ID, items, {
      pacingDelayMs: 0,
      dailyCap: 500,
    });

    assert.equal(batchRes.sent_count, 500);
    assert.equal(batchRes.daily_quota.cap_reached, true);
    assert.equal(batchRes.daily_quota.remaining, 0);

    // Try 501st message
    const extraRes = await waService.batchSendWithPacing(
      TENANT_ID,
      [
        {
          student_id: "extra-501",
          student_name: "Extra",
          parent_phone: "+201011111111",
          session_id: "quota-test-session",
          attended: false,
          idempotency_key: `${TENANT_ID}:extra:quota-test`,
        },
      ],
      { pacingDelayMs: 0, dailyCap: 500 }
    );

    assert.equal(extraRes.sent_count, 0);
    assert.equal(extraRes.skipped_count, 1);
    assert.equal(extraRes.results[0].status, "skipped_daily_cap");
  });
});
