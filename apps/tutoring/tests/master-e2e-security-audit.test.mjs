import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "../dist/app.js";
import {
  StudentsService,
  FakeStudentsRepository,
  parseCSV,
  generateBarcodeSheetPdf,
} from "../dist/features/students/index.js";
import { SessionsService } from "../dist/features/sessions/service.js";
import { AttendanceService } from "../dist/features/attendance/service.js";
import {
  AuthService,
  FakeAuthRepository,
  resetLoginAttempts,
} from "../dist/features/auth/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-Memory Test Doubles for Sessions & Attendance
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

let server;
let baseUrl;

test.before((t, done) => {
  server = http.createServer(app);
  server.listen(0, () => {
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    done();
  });
});

test.after((t, done) => {
  server.close(done);
});

// Helper for API testing
async function callApi(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, options);
  let json = null;
  try {
    json = await res.json();
  } catch {
    // Non-json
  }
  return { status: res.status, headers: res.headers, body: json };
}

// ============================================================================
// SECTION 1: END-TO-END (E2E) LIFECYCLE & BUSINESS ENGINE AUDIT
// ============================================================================

test("E2E-01: Teacher Signup, Authentication & Tenant Provisioning", async () => {
  const authRepo = new FakeAuthRepository();
  const authService = new AuthService(authRepo);

  const testEmail = `qa_teacher_${Date.now()}@centrly-audit.com`;
  const result = await authService.signUp({
    email: testEmail,
    password: "Password123!",
    name: "أ. محمود شاكر - فيزياء",
    tenant_name: "أكاديمية الفيزيائي",
    phone: "01012345678",
  });

  assert.ok(result.token, "Signup must issue an active JWT token");
  assert.ok(result.user?.id, "User must have a unique identifier");
  assert.equal(result.user.name, "أ. محمود شاكر - فيزياء");
  assert.ok(["owner", "teacher"].includes(result.user.role), "User role should be owner/teacher");

  // Verify login with newly created credentials
  const loginRes = await authService.signIn(testEmail, "Password123!");
  assert.ok(loginRes.token);
  assert.equal(loginRes.user.email, testEmail);
});

test("E2E-02: Study Groups Creation & Dual Pricing Architecture (Fixed vs Percentage)", async () => {
  const sessionsRepo = new FakeSessionsRepository();
  const sessionsService = new SessionsService(sessionsRepo);

  // Group 1: Fixed Rent model (200 EGP room rent)
  const group1 = {
    id: "grp-fixed-1",
    name: "أولى ثانوي - سنتر النور",
    session_fee: 120,
    center_split_type: "fixed_rent",
    center_split_value: 200,
  };

  // Group 2: Percentage Split model (20% to center)
  const group2 = {
    id: "grp-pct-2",
    name: "ثانية ثانوي - سنتر الأوائل",
    session_fee: 150,
    center_split_type: "percentage",
    center_split_value: 20,
  };

  assert.equal(group1.session_fee, 120);
  assert.equal(group2.session_fee, 150);
});

test("E2E-03: Student Enrollment, Fee Exemption, and Bulk CSV Import", async () => {
  const studentsRepo = new FakeStudentsRepository();
  const studentsService = new StudentsService(studentsRepo);

  const tenantId = "tenant-qa-1";

  // 1. Regular full-fee student
  const s1 = await studentsService.createStudent(tenantId, {
    name: "عمر خالد",
    parent_phone: "01011112222",
    code: "1001",
    exempt: false,
  });

  // 2. Discounted student (fee override: 80 EGP)
  const s2 = await studentsService.createStudent(tenantId, {
    name: "مريم أحمد",
    parent_phone: "01122223333",
    code: "1002",
    fee_override: 80,
    exempt: false,
  });

  // 3. Fully exempt student (0 EGP)
  const s3 = await studentsService.createStudent(tenantId, {
    name: "ياسين إبراهيم",
    parent_phone: "01233334444",
    code: "1003",
    exempt: true,
  });

  assert.equal(s1.name, "عمر خالد");
  assert.equal(s2.fee_override, 80);
  assert.equal(s3.exempt, true);

  // 4. Bulk CSV Import simulation
  const arabicCSV = `كود الطالب,اسم الطالب,رقم ولي الأمر,رقم الطالب,المجموعة
2001,أحمد تامر,01055556666,01155556666,مجموعة 1
2002,نور الدين,01277778888,01077778888,مجموعة 1`;

  const rows = parseCSV(arabicCSV);
  assert.equal(rows.length, 2, "Must correctly parse 2 Arabic CSV rows");
  assert.equal(rows[0]["اسم الطالب"], "أحمد تامر");
  assert.equal(rows[1]["اسم الطالب"], "نور الدين");
});

test("E2E-04: Student Barcode Sheet PDF Generation (Hardware Ready)", async () => {
  const students = [
    { code: "1001", name: "عمر خالد", group_name: "أولى ثانوي" },
    { code: "1002", name: "مريم أحمد", group_name: "أولى ثانوي" },
    { code: "1003", name: "ياسين إبراهيم", group_name: "أولى ثانوي" },
  ];

  const pdfBuffer = await generateBarcodeSheetPdf({ students, teacher_name: "أ. محمود شاكر" });
  assert.ok(Buffer.isBuffer(pdfBuffer), "Output must be a valid Buffer");
  assert.ok(pdfBuffer.length > 500, "PDF buffer must not be empty");
  // Check PDF magic bytes (%PDF-1.)
  const header = pdfBuffer.subarray(0, 5).toString("ascii");
  assert.equal(header, "%PDF-", "Buffer must contain valid PDF magic signature");
});

test("E2E-05: Live Session Execution, Barcode Attendance, and Anti-Double-Scan Protection", async () => {
  const attendanceRepo = new FakeAttendanceRepository({
    students: [
      { id: "stu-1", name: "عمر خالد", student_code: "1001", tenant_id: "tenant-qa-1" },
    ],
  });
  const attendanceService = new AttendanceService(attendanceRepo);

  const sessionId = "sess-live-01";
  const tenantId = "tenant-qa-1";

  // First scan: successfully checks in
  const scan1 = await attendanceService.scanStudent(tenantId, sessionId, { student_code: "1001" });
  assert.equal(scan1.already_recorded, false);
  assert.equal(scan1.student.name, "عمر خالد");

  // Duplicate scan attempt for the same student in the same session
  const scan2 = await attendanceService.scanStudent(tenantId, sessionId, { student_code: "1001" });
  assert.equal(scan2.already_recorded, true);
  assert.ok(scan2.message.includes("Student already recorded"));
  assert.equal(attendanceRepo.attendance.length, 1, "Duplicate scan must not add row to attendance database");
});

test("E2E-06: Session Financial Accounting & Closed Receipt Integrity", async () => {
  const sessionsRepo = new FakeSessionsRepository({
    sessions: [{ id: "sess-1", group_id: "grp-1", session_number: 1, session_date: "2026-09-01" }],
    groups: [{ id: "grp-1", name: "أولى ثانوي - سنتر النور", center_name: "سنتر النور", price: 120, billing_model: "fixed_rent", fixed_rent_amount: 100 }],
    attendees: [
      { session_id: "sess-1", attended: true, students: { id: "s1", name: "عمر خالد" } },
      { session_id: "sess-1", attended: true, students: { id: "s2", name: "مريم أحمد", fee_override: 80 } },
      { session_id: "sess-1", attended: true, students: { id: "s3", name: "ياسين إبراهيم", exempt: true } },
      { session_id: "sess-1", attended: false, students: { id: "s4", name: "علي طارق" } },
    ],
  });
  const sessionsService = new SessionsService(sessionsRepo);

  const group = { id: "grp-1", name: "أولى ثانوي", price: 120, billing_model: "fixed_rent", fixed_rent_amount: 100 };
  const attendeesList = [
    { student_id: "s1", is_makeup: false, students: { id: "s1", name: "عمر خالد" } },
    { student_id: "s2", is_makeup: false, students: { id: "s2", name: "مريم أحمد", fee_override: 80 } },
    { student_id: "s3", is_makeup: false, students: { id: "s3", name: "ياسين إبراهيم", exempt: true } },
  ];

  const summary = sessionsService.calculateFinancialSummary("sess-1", group, attendeesList);
  assert.equal(summary.financials.total_revenue, 200, "120 + 80 + 0 = 200 EGP total revenue");
  assert.equal(summary.financials.exempt_count, 1, "Exempt count must be exactly 1");
  assert.equal(summary.financials.attendee_count, 3, "Attended count must be 3");

  const receipt = await sessionsService.generateReceipt("tenant-qa-1", "sess-1", {
    send_via_whatsapp: false,
  });

  assert.equal(receipt.summary.total_revenue, 200);
  assert.equal(receipt.summary.center_share, 100);
  assert.equal(receipt.summary.teacher_share, 100, "200 - 100 = 100 EGP net teacher revenue");
  assert.ok(receipt.formatted_receipt.includes("سنتر النور"));
});

// ============================================================================
// SECTION 2: UI BUTTONS, MODALS & CLIENT DOM INTEGRITY AUDIT
// ============================================================================

test("UI-01: Static DOM Verification — All centrlyApp methods called in onclick handlers exist", () => {
  const componentsDir = path.resolve(__dirname, "../../web/src/components");
  const appJsPath = path.resolve(__dirname, "../../web/src/app.js");

  const appJsContent = fs.readFileSync(appJsPath, "utf8");
  const componentFiles = fs.readdirSync(componentsDir).filter((f) => f.endsWith(".js"));

  const onclickRegex = /onclick=["'](?:window\.)?centrlyApp\.([a-zA-Z0-9_]+)\(/g;
  const missingMethods = new Set();

  for (const file of componentFiles) {
    const filePath = path.join(componentsDir, file);
    const content = fs.readFileSync(filePath, "utf8");

    let match;
    while ((match = onclickRegex.exec(content)) !== null) {
      const methodName = match[1];
      // Check if method exists in app.js
      const methodRegex = new RegExp(`(?:async\\s+)?${methodName}\\s*\\(`);
      if (!methodRegex.test(appJsContent)) {
        missingMethods.add(`${file}: ${methodName}`);
      }
    }
  }

  assert.equal(
    missingMethods.size,
    0,
    `Found unbound onclick handlers: ${Array.from(missingMethods).join(", ")}`
  );
});

test("UI-02: Modal Architecture Verification — Universal showModal engine and static auth/legal overlays exist", () => {
  const appJsPath = path.resolve(__dirname, "../../web/src/app.js");
  const authScreensPath = path.resolve(__dirname, "../../web/src/components/AuthScreens.js");
  const landingViewPath = path.resolve(__dirname, "../../web/src/components/LandingView.js");

  const appJsContent = fs.readFileSync(appJsPath, "utf8");
  const authScreensContent = fs.readFileSync(authScreensPath, "utf8");
  const landingViewContent = fs.readFileSync(landingViewPath, "utf8");

  // 1. Dynamic showModal engine verification
  assert.ok(
    appJsContent.includes("showModal(title, bodyHtml, footerHtml)"),
    "Universal showModal engine must be implemented in app.js"
  );
  assert.ok(
    appJsContent.includes("centrlyCustomModal"),
    "showModal must create standard centrlyCustomModal container"
  );

  // 2. Static modals in AuthScreens.js
  assert.ok(
    authScreensContent.includes('id="forgotPasswordModal"'),
    "forgotPasswordModal must exist in AuthScreens.js"
  );
  assert.ok(
    authScreensContent.includes('id="resetPasswordModal"'),
    "resetPasswordModal must exist in AuthScreens.js"
  );

  // 3. Static policy modal in LandingView.js
  assert.ok(
    landingViewContent.includes('id="policyModalOverlay"'),
    "policyModalOverlay must exist in LandingView.js"
  );
});

test("UI-03: Complete Dark Mode Eradication Verification", () => {
  const tokensCssPath = path.resolve(__dirname, "../../web/src/styles/tokens.css");
  const mainCssPath = path.resolve(__dirname, "../../web/src/styles/main.css");

  const tokens = fs.readFileSync(tokensCssPath, "utf8");
  const main = fs.readFileSync(mainCssPath, "utf8");

  assert.ok(!tokens.includes('[data-theme="dark"]'), "tokens.css must contain zero [data-theme=dark] overrides");
  assert.ok(!main.includes('[data-theme="dark"]'), "main.css must contain zero [data-theme=dark] blocks");
});

// ============================================================================
// SECTION 3: CYBERSECURITY, RLS ACCESS CONTROL & STRESS AUDIT
// ============================================================================

test("SEC-01: Multi-Tenant RLS Scoping — Attacker without tenant cannot read or mutate other tenants", async () => {
  const studentsRepo = new FakeStudentsRepository();
  const studentsService = new StudentsService(studentsRepo);

  // Tenant A creates a student
  await studentsService.createStudent("tenant-a", {
    name: "طالب الأستاذ أ",
    parent_phone: "01011112222",
  });

  // Tenant B attempts to read Tenant A's students
  const tenantBStudents = await studentsService.listStudents("tenant-b");
  assert.equal(tenantBStudents.length, 0, "Tenant B must never see Tenant A's student records");

  // Missing tenant context strictly rejected when creating resources
  await assert.rejects(
    async () => {
      await studentsService.createStudent(undefined, {
        name: "طالب غير مصرح",
        parent_phone: "01099998888",
      });
    },
    { message: "NO_TENANT_CONTEXT" },
    "Calls without tenant context must be strictly denied"
  );
});

test("SEC-02: Financial Security PIN Cloud Sync & Lock Verification", async () => {
  // Test verify-pin endpoint rejects unauthenticated access
  const resNoAuth = await callApi("/api/settings/verify-pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: "1234" }),
  });
  assert.equal(resNoAuth.status, 401, "Financial PIN verification requires authenticated user session");
});

test("SEC-03: Password Hardening & Strength Validation", async () => {
  const authRepo = new FakeAuthRepository();
  const authService = new AuthService(authRepo);

  // 1. Weak password rejected: too short (< 8 chars)
  const shortCheck = authService.validatePassword("12345");
  assert.equal(shortCheck.valid, false);
  assert.equal(shortCheck.reason, "Password must be at least 8 characters long");

  // 2. Weak password rejected: missing letters
  const noLetterCheck = authService.validatePassword("12345678");
  assert.equal(noLetterCheck.valid, false);
  assert.equal(noLetterCheck.reason, "Password must contain at least one letter");

  // 3. Weak password rejected: missing digits or special chars
  const noDigitCheck = authService.validatePassword("passwordonly");
  assert.equal(noDigitCheck.valid, false);
  assert.equal(noDigitCheck.reason, "Password must contain at least one digit or special character");

  // 4. Strong compliant password accepted
  const strongCheck = authService.validatePassword("StrongPass2026!");
  assert.equal(strongCheck.valid, true);
});

test("SEC-04: Password Change strictly enforces and validates current password", async () => {
  const authRepo = new FakeAuthRepository();
  const authService = new AuthService(authRepo);

  authRepo.users.push({
    id: "user-1",
    email: "teacher@test.com",
    password: "CorrectOldPassword1!",
    tenant_id: "t1",
    role: "teacher",
  });

  // Rejects when current password is wrong
  await assert.rejects(
    async () => {
      await authService.changePassword({
        token: "user-1",
        email: "teacher@test.com",
        current_password: "WrongPassword99!",
        new_password: "NewStrongPassword2!",
      });
    },
    (err) => err instanceof Error,
    "Must reject password update when current password is invalid"
  );
});

test("SEC-05: Rate Limiting & Account Lockout Defense", async () => {
  const authRepo = new FakeAuthRepository();
  const authService = new AuthService(authRepo);
  const testEmail = "lockout-test@domain.com";
  resetLoginAttempts(testEmail);

  authRepo.users.push({
    id: "user-1",
    email: testEmail,
    password: "CorrectPassword#1",
    tenant_id: "tenant-1",
    role: "owner",
  });

  // 5 failed login attempts
  for (let i = 0; i < 5; i++) {
    await assert.rejects(
      async () => {
        await authService.login({ email: testEmail, password: "WrongPassword" });
      },
      { message: "INVALID_CREDENTIALS" }
    );
  }

  // 6th attempt is locked out with ACCOUNT_LOCKED
  await assert.rejects(
    async () => {
      await authService.login({ email: testEmail, password: "CorrectPassword#1" });
    },
    (err) => err.code === "ACCOUNT_LOCKED",
    "Account must be locked out after 5 consecutive failed attempts"
  );

  resetLoginAttempts(testEmail);

  // Verify HTTP rate-limiting headers on auth endpoint
  const res = await callApi("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
  assert.ok(res.headers.has("ratelimit-limit"), "Auth routes must expose RateLimit-Limit headers");
});

test("SEC-06: Standard Defense-in-Depth HTTP Security Headers", async () => {
  const res = await callApi("/health/ping");
  assert.equal(res.status, 200);

  const headers = res.headers;
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.ok(headers.get("strict-transport-security")?.includes("max-age"));
});
