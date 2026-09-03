import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../dist/app.js";
import { isValidEgyptianPhone, normalizePhoneNumber } from "../dist/services/importService.js";
import { generateBarcodeSheetPdf } from "../dist/services/barcodePdfService.js";

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

// ========================================================
// Task 1: DEV-39 (Subscription Lifecycle & Payment Proofs)
// ========================================================

test("DEV-39: Billing payment-proof rejects unauthenticated requests", async () => {
  const res = await fetch(`${baseUrl}/api/billing/payment-proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 500, payment_method: "instapay" }),
  });
  assert.equal(res.status, 401);
});

test("DEV-39: Billing status endpoint requires authentication", async () => {
  const res = await fetch(`${baseUrl}/api/billing/status`);
  assert.equal(res.status, 401);
});

// ========================================================
// Task 3: DEV-41 (Password Reset Flow)
// ========================================================

test("DEV-41: Forgot password endpoint handles email gracefully", async () => {
  const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "teacher-test@example.com" }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.message.includes("password recovery link"));
});

test("DEV-41: Reset password endpoint rejects weak passwords", async () => {
  const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "dummy-token", password: "123" }),
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error.code, "WEAK_PASSWORD");
});

// ========================================================
// Task 5: DEV-43 (Egyptian Phone Validation Hardening)
// ========================================================

test("DEV-43: Strict Egyptian phone validator accepts valid Egyptian numbers", () => {
  assert.equal(isValidEgyptianPhone("01012345678"), true);
  assert.equal(isValidEgyptianPhone("01123456789"), true);
  assert.equal(isValidEgyptianPhone("01234567890"), true);
  assert.equal(isValidEgyptianPhone("01545678901"), true);
  assert.equal(isValidEgyptianPhone("+201012345678"), true);
  assert.equal(isValidEgyptianPhone("00201123456789"), true);
});

test("DEV-43: Strict Egyptian phone validator rejects invalid numbers", () => {
  assert.equal(isValidEgyptianPhone("01312345678"), false); // 013 is not mobile
  assert.equal(isValidEgyptianPhone("0101234567"), false);  // 10 digits
  assert.equal(isValidEgyptianPhone("010123456789"), false); // 12 digits
  assert.equal(isValidEgyptianPhone("0233445566"), false);  // Landline
  assert.equal(isValidEgyptianPhone("abcdefghijk"), false);
  assert.equal(isValidEgyptianPhone(""), false);
  assert.equal(isValidEgyptianPhone(null), false);
});

test("DEV-43: Session delivery status endpoint rejects unauthenticated access", async () => {
  const dummySessionId = "00000000-0000-0000-0000-000000000000";
  const res = await fetch(`${baseUrl}/api/sessions/${dummySessionId}/delivery-status`);
  assert.equal(res.status, 401);
});

// ========================================================
// Task 6: DEV-44 (Audit Trail / Activity Log)
// ========================================================

test("DEV-44: Activity logs endpoint requires authentication", async () => {
  const res = await fetch(`${baseUrl}/api/activity-logs`);
  assert.equal(res.status, 401);
});

// ========================================================
// Task 7: DEV-45 (Session WhatsApp Receipt Generator)
// ========================================================

test("DEV-45: Receipt generator endpoint rejects unauthenticated access", async () => {
  const dummySessionId = "00000000-0000-0000-0000-000000000000";
  const res = await fetch(`${baseUrl}/api/sessions/${dummySessionId}/receipt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 401);
});

// ========================================================
// Task 8: DEV-46 (A4 PDF Barcode Sheet Generator)
// ========================================================

test("DEV-46: Generates valid A4 PDF buffer with %PDF header", async () => {
  const mockStudents = [
    { id: "s1", name: "أحمد مصطفى", student_code: "1001" },
    { id: "s2", name: "محمود حسن", student_code: "1002" },
    { id: "s3", name: "مريم علي", student_code: "1003" },
  ];

  const pdfBuffer = await generateBarcodeSheetPdf({
    group_name: "الفيزياء - الصف الأول الثانوي",
    students: mockStudents,
  });

  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.ok(pdfBuffer.length > 500, "PDF buffer should contain binary data");

  // Verify PDF magic header bytes: %PDF-
  const header = pdfBuffer.slice(0, 5).toString("utf-8");
  assert.equal(header, "%PDF-");
});
