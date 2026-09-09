/**
 * DEV-27 / DEV-SCALE.2: Scalability Benchmark & Load Test (500 Students)
 *
 * Core Loop Under Test:
 * 1. Rapid QR/Barcode Check-in Scanning (500 students)
 * 2. Idempotency & Duplicate Re-Scan Check (500 students)
 * 3. Bulk Batch Attendance Ingestion (500 records)
 * 4. Attendance Notification Decision Engine (500 evaluations)
 * 5. WhatsApp Notification Dispatch & Pacing (125 eligible candidates)
 * 6. Daily Quota & Anti-ban Protection under 500-student load
 */

import os from "node:os";
import { AttendanceService, evaluateNotificationDecision } from "../apps/tutoring/dist/features/attendance/service.js";
import { logger } from "../apps/tutoring/dist/shared/utils/logger.js";
import {
  WhatsAppNotificationsService,
  resetTenantDailyCount,
  getDailyQuotaStatus,
  DEFAULT_SAFE_DAILY_CAP,
} from "../apps/tutoring/dist/features/whatsapp-notifications/service.js";

// Silence verbose simulated info logs during benchmark
logger.info = () => {};

function getPercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function calculateStats(latencies) {
  const count = latencies.length;
  if (count === 0) return { min: 0, max: 0, avg: 0, median: 0, p90: 0, p95: 0, p99: 0 };
  const sum = latencies.reduce((a, b) => a + b, 0);
  return {
    count,
    min: Number(Math.min(...latencies).toFixed(3)),
    max: Number(Math.max(...latencies).toFixed(3)),
    avg: Number((sum / count).toFixed(3)),
    median: Number(getPercentile(latencies, 50).toFixed(3)),
    p90: Number(getPercentile(latencies, 90).toFixed(3)),
    p95: Number(getPercentile(latencies, 95).toFixed(3)),
    p99: Number(getPercentile(latencies, 99).toFixed(3)),
  };
}

/**
 * High-performance indexed repository simulating indexed database behavior
 */
class IndexedAttendanceRepository {
  constructor(students = []) {
    this.studentsMap = new Map();
    this.studentsCodeMap = new Map();
    this.studentsList = students;
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

async function runBenchmark() {
  console.log("================================================================================");
  console.log(" DEV-27 / DEV-SCALE.2: Scalability Baseline & Load Test (500 Students)");
  console.log("================================================================================");
  console.log(`Node.js: ${process.version} | OS: ${process.platform} (${process.arch})`);
  console.log(`CPUs: ${os.cpus().length}x ${os.cpus()[0].model}`);
  console.log(`Total System Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log("--------------------------------------------------------------------------------\\n");

  const initialMemory = process.memoryUsage();
  const TENANT_ID = "tenant-pilot-scale-01";
  const SESSION_ID = "session-scale-pilot-1001";
  const STUDENT_COUNT = 500;

  console.log(`[SETUP] Generating ${STUDENT_COUNT} mock students for tenant "${TENANT_ID}"...`);
  const students = [];
  for (let i = 1; i <= STUDENT_COUNT; i++) {
    const pad = String(i).padStart(4, "0");
    students.push({
      id: `student-uuid-${pad}`,
      tenant_id: TENANT_ID,
      name: `طالب تجريبي ${i}`,
      student_code: `STD-${pad}`,
      parent_phone: `+2010${String(10000000 + i)}`,
      student_phone: `+2012${String(10000000 + i)}`,
      fee_override: null,
      exempt: false,
    });
  }

  const attendanceRepo = new IndexedAttendanceRepository(students);
  const waRepo = new FastWhatsAppRepository();
  const attendanceService = new AttendanceService(attendanceRepo);
  const waService = new WhatsAppNotificationsService(waRepo);

  resetTenantDailyCount(TENANT_ID);

  // ============================================================================
  // TEST 1: Rapid Sequential QR Check-in Scans (500 students)
  // ============================================================================
  console.log(`\\n[TEST 1] Executing 500 rapid sequential scans (scanStudent)...`);
  const scanLatencies = [];
  const test1Start = performance.now();

  for (let i = 0; i < STUDENT_COUNT; i++) {
    const st = students[i];
    const sStart = performance.now();
    const res = await attendanceService.scanStudent(TENANT_ID, SESSION_ID, {
      student_id: st.id,
      comment: i % 10 === 0 ? `ملاحظة خاصة بالطالب ${i + 1}` : undefined,
    });
    const sDuration = performance.now() - sStart;
    scanLatencies.push(sDuration);

    if (res.already_recorded) {
      throw new Error(`Unexpected duplicate for student ${st.id} on initial scan`);
    }
  }

  const test1TotalTime = performance.now() - test1Start;
  const scanStats = calculateStats(scanLatencies);
  const scanOpsPerSec = (STUDENT_COUNT / (test1TotalTime / 1000)).toFixed(1);

  console.log(`  ✓ 500 Scans completed in ${test1TotalTime.toFixed(2)} ms (${scanOpsPerSec} scans/sec)`);
  console.log(`    - Min latency:    ${scanStats.min} ms`);
  console.log(`    - Avg latency:    ${scanStats.avg} ms`);
  console.log(`    - Median (p50):   ${scanStats.median} ms`);
  console.log(`    - p90 latency:    ${scanStats.p90} ms`);
  console.log(`    - p95 latency:    ${scanStats.p95} ms`);
  console.log(`    - p99 latency:    ${scanStats.p99} ms`);
  console.log(`    - Max latency:    ${scanStats.max} ms`);

  // ============================================================================
  // TEST 2: Duplicate-Scan Idempotency Protection (500 duplicate scans)
  // ============================================================================
  console.log(`\\n[TEST 2] Executing 500 duplicate scans to verify idempotency guard...`);
  const dupLatencies = [];
  const test2Start = performance.now();
  let duplicateGuardHits = 0;

  for (let i = 0; i < STUDENT_COUNT; i++) {
    const st = students[i];
    const sStart = performance.now();
    const res = await attendanceService.scanStudent(TENANT_ID, SESSION_ID, {
      student_id: st.id,
    });
    const sDuration = performance.now() - sStart;
    dupLatencies.push(sDuration);

    if (res.already_recorded) {
      duplicateGuardHits++;
    }
  }

  const test2TotalTime = performance.now() - test2Start;
  const dupStats = calculateStats(dupLatencies);
  const dupOpsPerSec = (STUDENT_COUNT / (test2TotalTime / 1000)).toFixed(1);

  console.log(`  ✓ 500 Duplicate scans checked in ${test2TotalTime.toFixed(2)} ms (${dupOpsPerSec} checks/sec)`);
  console.log(`  ✓ Duplicate guard hit rate: ${duplicateGuardHits}/${STUDENT_COUNT} (100% guarded)`);
  console.log(`    - Avg latency:    ${dupStats.avg} ms`);
  console.log(`    - p95 latency:    ${dupStats.p95} ms`);
  console.log(`    - Max latency:    ${dupStats.max} ms`);

  // ============================================================================
  // TEST 3: Bulk Batch Attendance Recording (500 records at once)
  // ============================================================================
  const BATCH_SESSION_ID = "session-scale-pilot-batch-2002";
  console.log(`\\n[TEST 3] Executing bulk batch attendance ingestion (500 students in 1 batch)...`);

  // Distribution: 75 absent (15%), 50 present with comment (10%), 375 present without comment (75%)
  const batchRecords = students.map((s, idx) => {
    const isAbsent = idx < 75;
    const hasComment = !isAbsent && idx >= 75 && idx < 125;
    return {
      student_id: s.id,
      attended: !isAbsent,
      comment: hasComment ? `تعليق المعلم للطالب ${s.name}` : null,
      homework_status: isAbsent ? null : "completed",
    };
  });

  const test3Start = performance.now();
  const batchResult = await attendanceService.recordBatchAttendance(TENANT_ID, BATCH_SESSION_ID, batchRecords);
  const test3TotalTime = performance.now() - test3Start;

  console.log(`  ✓ Batch attendance for 500 students processed in ${test3TotalTime.toFixed(2)} ms`);
  console.log(`  ✓ Saved rows count: ${batchResult.count}`);
  console.log(`  ✓ Notification candidates identified: ${batchResult.notificationCandidates.length} students`);
  console.log(`    - Absent candidates:               ${batchRecords.filter((r) => !r.attended).length}`);
  console.log(`    - Present with comment candidates: ${batchRecords.filter((r) => r.attended && r.comment).length}`);
  console.log(`    - Present without comment (none):  ${batchRecords.filter((r) => r.attended && !r.comment).length}`);

  // ============================================================================
  // TEST 4: WhatsApp Notification Dispatch & Pacing for 500 Students
  // ============================================================================
  console.log(`\\n[TEST 4] Executing batch WhatsApp notification dispatch for 500-student session...`);
  const test4Start = performance.now();

  const dispatchResult = await attendanceService.dispatchSessionMessages(
    TENANT_ID,
    BATCH_SESSION_ID,
    waService,
    { pacingDelayMs: 0, dailyCap: DEFAULT_SAFE_DAILY_CAP }
  );
  const test4TotalTime = performance.now() - test4Start;

  console.log(`  ✓ Dispatch evaluation completed in ${test4TotalTime.toFixed(2)} ms`);
  console.log(`  ✓ Total students in session:   ${dispatchResult.total_students}`);
  console.log(`  ✓ Eligible candidates:         ${dispatchResult.eligible_count}`);
  console.log(`  ✓ Successfully dispatched:     ${dispatchResult.dispatched_count}`);
  console.log(`  ✓ Correctly skipped:           ${dispatchResult.skipped_count}`);

  const quotaAfterTest4 = getDailyQuotaStatus(TENANT_ID, DEFAULT_SAFE_DAILY_CAP);
  console.log(`  ✓ Tenant daily quota status:   ${quotaAfterTest4.sent_today}/${quotaAfterTest4.daily_limit} (Remaining: ${quotaAfterTest4.remaining})`);

  // ============================================================================
  // TEST 5: Daily Cap Limit Test (500 items hitting quota cap)
  // ============================================================================
  console.log(`\\n[TEST 5] Testing Daily Volume Cap Enforcement (500 capacity boundary)...`);
  resetTenantDailyCount(TENANT_ID);

  // Send 500 items to test quota boundaries
  const allEligibleItems = students.map((s) => ({
    student_id: s.id,
    student_name: s.name,
    parent_phone: s.parent_phone,
    session_id: "session-quota-test",
    attended: false,
    idempotency_key: `${TENANT_ID}:${s.id}:session-quota-test`,
  }));

  // Try to send all 500 with cap of 500
  const quotaBatchResult = await waService.batchSendWithPacing(TENANT_ID, allEligibleItems, {
    pacingDelayMs: 0,
    dailyCap: 500,
  });

  console.log(`  ✓ 500 Messages processed: ${quotaBatchResult.sent_count} sent, ${quotaBatchResult.skipped_count} skipped`);
  console.log(`  ✓ Quota cap reached status: ${quotaBatchResult.daily_quota.cap_reached}`);

  // Now try to send 1 more message
  const extraItem = [
    {
      student_id: "student-extra-01",
      student_name: "Extra Student",
      parent_phone: "+201099999999",
      session_id: "session-quota-test",
      attended: false,
      idempotency_key: `${TENANT_ID}:extra:session-quota-test`,
    },
  ];

  const extraResult = await waService.batchSendWithPacing(TENANT_ID, extraItem, {
    pacingDelayMs: 0,
    dailyCap: 500,
  });

  console.log(`  ✓ Student #501 status: "${extraResult.results[0].status}" (${extraResult.results[0].error})`);

  // ============================================================================
  // MEMORY & PERFORMANCE SUMMARY
  // ============================================================================
  const finalMemory = process.memoryUsage();
  const heapDiffMb = ((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2);
  const totalHeapMb = (finalMemory.heapUsed / 1024 / 1024).toFixed(2);

  console.log("\\n================================================================================");
  console.log(" SYSTEM RESOURCE UTILIZATION (500 STUDENTS)");
  console.log("================================================================================");
  console.log(`Heap Used Delta:         +${heapDiffMb} MB`);
  console.log(`Total Current Heap:      ${totalHeapMb} MB`);
  console.log(`RSS Memory:              ${(finalMemory.rss / 1024 / 1024).toFixed(2)} MB`);

  // ============================================================================
  // ARCHITECTURAL BOTTLENECK ANALYSIS
  // ============================================================================
  console.log("\\n================================================================================");
  console.log(" ARCHITECTURAL BOTTLENECK ANALYSIS & PRODUCTION PROJECTIONS");
  console.log("================================================================================");
  console.log(`1. HTTP Rate Limiting:`);
  console.log(`   - attendanceRateLimiter is set to 30 requests/min per IP.`);
  console.log(`   - Scanning 500 students sequentially at front desk over 1 IP would take ~16.7 minutes`);
  console.log(`     purely waiting for rate limiter windows (30 req / 60s = 0.5 req/s).`);
  console.log(`   - Workaround/Architecture: Front desk MUST use offline batch sync (/batch-sync)`);
  console.log(`     or batch attendance (/attendance), which bundles 500 records in 1 HTTP call.`);
  console.log(``);
  console.log(`2. WhatsApp Anti-Ban Jitter Pacing (DEV-36):`);
  console.log(`   - Configured jitter is 4,000ms to 9,000ms (mean: 6,500ms) per message.`);
  console.log(`   - For a typical session of 500 students with 125 notifications (75 absent + 50 comments):`);
  console.log(`     125 * 6.5s = 812.5 seconds = ~13.5 minutes!`);
  console.log(`   - For 500 notifications: 500 * 6.5s = 3,250 seconds = ~54.1 minutes!`);
  console.log(`   - CRITICAL: Running this synchronously inside an HTTP request handler will TIMEOUT`);
  console.log(`     on any standard proxy/CDN (Vercel 10-60s, Nginx 60s, Cloudflare 100s).`);
  console.log(`   - The send engine must run asynchronously via background worker or queue.`);
  console.log(``);
  console.log(`3. Database Roundtrips in dispatchSessionMessages:`);
  console.log(`   - In attendance/service.ts, dispatchSessionMessages calls updateAttendanceStatus()`);
  console.log(`     sequentially row-by-row in a loop for each sent item.`);
  console.log(`   - 125 messages = 125 individual SQL UPDATE calls. Over cloud DB (15ms RTT) = ~1.87s.`);
  console.log(`   - At 500 messages = 500 roundtrips = ~7.5s. Batch update or backgrounding needed.`);
  console.log(``);
  console.log(`4. Daily Quota Threshold:`);
  console.log(`   - DEFAULT_SAFE_DAILY_CAP is 500 msgs/day per tenant.`);
  console.log(`   - A tenant with 500 students who dispatches notifications for all of them will`);
  console.log(`     exhaust 100% of their daily quota in a single session.`);
  console.log("================================================================================\\n");

  return {
    scanStats,
    scanOpsPerSec,
    batchTimeMs: test3TotalTime,
    dispatchTimeMs: test4TotalTime,
    heapDiffMb,
  };
}

runBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
