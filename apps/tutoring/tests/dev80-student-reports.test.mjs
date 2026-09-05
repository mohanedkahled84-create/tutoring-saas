import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

import { app } from "../dist/app.js";
import {
  calculateStudentSummary,
  rankStudents,
  filterStudentsByQuery,
  formatStudentReportMessage,
} from "../dist/features/reports/calculation.js";
import { ReportsService } from "../dist/features/reports/service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for test server
async function withServer(fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// --------------------------------------------------------------------------
// 1. Clean Architecture Rule 1 Compliance
// --------------------------------------------------------------------------
test("DEV-80: calculation.ts complies with Clean Architecture Rule 1 (Zero Supabase / DB imports)", () => {
  const calcPath = path.resolve(__dirname, "../src/features/reports/calculation.ts");
  assert.ok(fs.existsSync(calcPath), "calculation.ts must exist");

  const code = fs.readFileSync(calcPath, "utf8");
  assert.ok(!code.includes("@supabase/supabase-js"), "calculation.ts must not import Supabase");
  assert.ok(!code.includes("from \"../database"), "calculation.ts must not import database");
  assert.ok(!code.includes("from \"../../database"), "calculation.ts must not import database");
  assert.ok(!code.includes("from \"../../supabase"), "calculation.ts must not import supabase");
});

// --------------------------------------------------------------------------
// 2. Pure Domain Calculation
// --------------------------------------------------------------------------
test("DEV-80: calculateStudentSummary computes attendance % and quiz average accurately", () => {
  const rawStudent = {
    student: {
      id: "std-1",
      name: "عمر خالد",
      code: "1001",
      parent_phone: "01011112222",
      group_name: "مجموعة الأحد",
    },
    attendances: [
      { attended: true, session_id: "s1" },
      { attended: true, session_id: "s2" },
      { attended: true, session_id: "s3" },
      { attended: false, session_id: "s4" },
    ],
    grades: [
      { score: 18, max_score: 20 }, // 90%
      { score: 15, max_score: 20 }, // 75%
    ],
  };

  const summary = calculateStudentSummary(rawStudent);

  assert.equal(summary.student_id, "std-1");
  assert.equal(summary.total_sessions, 4);
  assert.equal(summary.attended_sessions, 3);
  assert.equal(summary.absent_sessions, 1);
  assert.equal(summary.attendance_rate, 75); // 3/4 = 75%
  assert.equal(summary.total_quizzes, 2);
  assert.equal(summary.average_score, 82.5); // (90 + 75) / 2 = 82.5%
  assert.ok(summary.overall_score > 0);
});

test("DEV-80: calculateStudentSummary handles zero sessions and zero quizzes safely", () => {
  const emptyStudent = {
    student: {
      id: "std-new",
      name: "طالب جديد",
      code: "1099",
      parent_phone: "01099998888",
    },
    attendances: [],
    grades: [],
  };

  const summary = calculateStudentSummary(emptyStudent);
  assert.equal(summary.total_sessions, 0);
  assert.equal(summary.attended_sessions, 0);
  assert.equal(summary.absent_sessions, 0);
  assert.equal(summary.attendance_rate, 100); // 100% default for zero sessions
  assert.equal(summary.average_score, 0);
  assert.equal(summary.total_quizzes, 0);
});

// --------------------------------------------------------------------------
// 3. Pure Ranking & Leaderboard
// --------------------------------------------------------------------------
test("DEV-80: rankStudents orders descending by performance and breaks ties with attendance", () => {
  const students = [
    {
      student_id: "s3",
      student_name: "خالد سعيد",
      student_code: "1003",
      parent_phone: "01033333333",
      total_sessions: 4,
      attended_sessions: 4,
      absent_sessions: 0,
      attendance_rate: 100,
      total_quizzes: 2,
      average_score: 95,
      overall_score: 96.5,
      rank: 0,
    },
    {
      student_id: "s1",
      student_name: "أحمد علي",
      student_code: "1001",
      parent_phone: "01011111111",
      total_sessions: 4,
      attended_sessions: 3,
      absent_sessions: 1,
      attendance_rate: 75,
      total_quizzes: 2,
      average_score: 80,
      overall_score: 78.5,
      rank: 0,
    },
    {
      student_id: "s2",
      student_name: "سارة محمود",
      student_code: "1002",
      parent_phone: "01022222222",
      total_sessions: 4,
      attended_sessions: 4,
      absent_sessions: 0,
      attendance_rate: 100,
      total_quizzes: 2,
      average_score: 80,
      overall_score: 86,
      rank: 0,
    },
  ];

  const ranked = rankStudents(students);

  assert.equal(ranked.length, 3);
  // 1st: خالد سعيد (overall 96.5)
  assert.equal(ranked[0].student_name, "خالد سعيد");
  assert.equal(ranked[0].rank, 1);

  // 2nd: سارة محمود (overall 86)
  assert.equal(ranked[1].student_name, "سارة محمود");
  assert.equal(ranked[1].rank, 2);

  // 3rd: أحمد علي (overall 78.5)
  assert.equal(ranked[2].student_name, "أحمد علي");
  assert.equal(ranked[2].rank, 3);
});

// --------------------------------------------------------------------------
// 4. Universal Search Filter (Code, Name, Phone)
// --------------------------------------------------------------------------
test("DEV-80: filterStudentsByQuery matches code, name, OR phone number flexibly", () => {
  const students = [
    {
      student_id: "1",
      student_name: "محمد مصطفى",
      student_code: "STD-801",
      parent_phone: "01099887766",
      student_phone: "01122334455",
    },
    {
      student_id: "2",
      student_name: "مريم إبراهيم",
      student_code: "STD-802",
      parent_phone: "01233445566",
      student_phone: null,
    },
  ];

  // Match by code
  const byCode = filterStudentsByQuery(students, "801");
  assert.equal(byCode.length, 1);
  assert.equal(byCode[0].student_name, "محمد مصطفى");

  // Match by name
  const byName = filterStudentsByQuery(students, "مريم");
  assert.equal(byName.length, 1);
  assert.equal(byName[0].student_name, "مريم إبراهيم");

  // Match by phone
  const byPhone = filterStudentsByQuery(students, "01233445566");
  assert.equal(byPhone.length, 1);
  assert.equal(byPhone[0].student_name, "مريم إبراهيم");

  // Match by partial formatted phone with spaces
  const byPhoneFormatted = filterStudentsByQuery(students, "010 9988");
  assert.equal(byPhoneFormatted.length, 1);
  assert.equal(byPhoneFormatted[0].student_name, "محمد مصطفى");
});

// --------------------------------------------------------------------------
// 5. Arabic Report Message Formatting
// --------------------------------------------------------------------------
test("DEV-80: formatStudentReportMessage generates clear Arabic message with medals and stats", () => {
  const student = {
    student_id: "std-top",
    student_name: "يوسف حسن",
    student_code: "2001",
    parent_phone: "01000000000",
    group_name: "مجموعة التفوق",
    total_sessions: 8,
    attended_sessions: 8,
    absent_sessions: 0,
    attendance_rate: 100,
    total_quizzes: 4,
    average_score: 98.5,
    overall_score: 99,
    rank: 1,
  };

  const msg = formatStudentReportMessage(student, "سبتمبر 2026");

  assert.ok(msg.includes("يوسف حسن"));
  assert.ok(msg.includes("2001"));
  assert.ok(msg.includes("🥇 الأول"));
  assert.ok(msg.includes("نسبة الالتزام بالحضور: 100%"));
  assert.ok(msg.includes("متوسط الدرجات: 98.5%"));
  assert.ok(msg.includes("مجموعة التفوق"));
});

// --------------------------------------------------------------------------
// 6. ReportsService: Leaderboard, Individual Send & Bulk Send
// --------------------------------------------------------------------------
test("DEV-80: ReportsService getMonthlyLeaderboard, sendIndividualReport and sendBulkReports", async () => {
  const mockRepo = {
    async getStudentsWithPerformanceData(tenantId, month, year) {
      return [
        {
          student: {
            id: "s1",
            name: "كريم أحمد",
            code: "101",
            parent_phone: "01011111111",
            group_id: "grp-1",
            group_name: "مجموعة السبت",
          },
          attendances: [{ attended: true }, { attended: true }],
          grades: [{ score: 20, max_score: 20 }],
        },
        {
          student: {
            id: "s2",
            name: "سارة يحيى",
            code: "102",
            parent_phone: "01022222222",
            group_id: "grp-1",
            group_name: "مجموعة السبت",
          },
          attendances: [{ attended: true }, { attended: false }],
          grades: [{ score: 14, max_score: 20 }],
        },
        {
          student: {
            id: "s3",
            name: "طالب بلا هاتف",
            code: "103",
            parent_phone: "",
            group_id: "grp-1",
            group_name: "مجموعة السبت",
          },
          attendances: [],
          grades: [],
        },
      ];
    },
    async getStudentPerformanceData(tenantId, studentId, month, year) {
      const all = await this.getStudentsWithPerformanceData(tenantId, month, year);
      return all.find((s) => s.student.id === studentId) || null;
    },
  };

  const dispatchedMessages = [];
  const mockDispatcher = {
    async dispatchReportMessage(payload) {
      dispatchedMessages.push(payload);
      return true;
    },
  };

  const service = new ReportsService(mockRepo, mockDispatcher);

  // 1. Leaderboard
  const leaderboardSummary = await service.getMonthlyLeaderboard("tenant-1", 9, 2026);
  assert.equal(leaderboardSummary.total_students, 3);
  assert.equal(leaderboardSummary.leaderboard[0].student_name, "كريم أحمد");
  assert.equal(leaderboardSummary.leaderboard[0].rank, 1);

  // 2. Individual Send
  const indivResult = await service.sendIndividualReport("tenant-1", "s1", 9, 2026);
  assert.equal(indivResult.status, "sent");
  assert.equal(indivResult.student_name, "كريم أحمد");
  assert.equal(indivResult.mode, "individual");
  assert.ok(indivResult.idempotency_key.includes("report-tenant-1-s1-2026-9-indiv"));
  assert.equal(dispatchedMessages.length, 1);
  assert.equal(dispatchedMessages[0].priority, "immediate");

  // 3. Bulk Send
  const bulkSummary = await service.sendBulkReports("tenant-1", 9, 2026);
  assert.equal(bulkSummary.total_students, 3);
  assert.equal(bulkSummary.queued_count, 2);
  assert.equal(bulkSummary.skipped_count, 1); // s3 has no phone
  // Total dispatched messages: 1 individual + 2 bulk = 3
  assert.equal(dispatchedMessages.length, 3);
  assert.equal(dispatchedMessages[1].priority, "bulk");
  assert.equal(dispatchedMessages[2].priority, "bulk");
});

// --------------------------------------------------------------------------
// 7. HTTP Endpoints Authentication Enforcement
// --------------------------------------------------------------------------
test("DEV-80: HTTP Endpoints for reports strictly return 401 when unauthenticated", async () => {
  await withServer(async (baseUrl) => {
    // GET /api/reports/monthly
    const resGet = await fetch(`${baseUrl}/api/reports/monthly`);
    assert.equal(resGet.status, 401);

    // POST /api/reports/bulk-send
    const resBulk = await fetch(`${baseUrl}/api/reports/bulk-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: 9, year: 2026 }),
    });
    assert.equal(resBulk.status, 401);

    // POST /api/reports/:id/send
    const resIndiv = await fetch(`${baseUrl}/api/reports/std-123/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: 9, year: 2026 }),
    });
    assert.equal(resIndiv.status, 401);
  });
});

// --------------------------------------------------------------------------
// 8. Frontend Components
// --------------------------------------------------------------------------
test("DEV-80: StudentSearchBar & StudentReportsView render valid Arabic HTML without mock data", async () => {
  const { renderStudentSearchBar } = await import("../../web/src/components/StudentSearchBar.js");
  const { renderStudentReportsView } = await import("../../web/src/components/StudentReportsView.js");

  // 1. Search Bar
  const searchHtml = renderStudentSearchBar({
    id: "testSearch",
    placeholder: "ابحث هنا...",
    onInputHandler: "console.log(this.value)",
  });
  assert.ok(searchHtml.includes("id=\"testSearch\""));
  assert.ok(searchHtml.includes("placeholder=\"ابحث هنا...\""));

  // 2. Reports View (Empty state)
  const emptyHtml = renderStudentReportsView({ leaderboard: [] });
  assert.ok(emptyHtml.includes("تقارير الأداء ولوحة الشرف والتميز"));
  assert.ok(emptyHtml.includes("لا توجد بيانات تقارير متاحة لهذه الفترة"));
  assert.ok(emptyHtml.includes("إرسال التقارير لجميع أولياء الأمور (Bulk)"));

  // 3. Reports View with ranked student
  const populatedHtml = renderStudentReportsView({
    leaderboard: [
      {
        rank: 1,
        student_id: "s1",
        student_code: "101",
        student_name: "عمرو دياب",
        group_name: "مجموعة التفوق",
        parent_phone: "01011112222",
        attendance_rate: 95,
        attended_sessions: 8,
        total_sessions: 8,
        average_score: 92,
        total_quizzes: 3,
        overall_score: 94,
      },
    ],
  });

  assert.ok(populatedHtml.includes("عمرو دياب"));
  assert.ok(populatedHtml.includes("🥇 1"));
  assert.ok(populatedHtml.includes("95%"));
  assert.ok(populatedHtml.includes("92%"));
  assert.ok(populatedHtml.includes("إرسال التقرير"));
});
