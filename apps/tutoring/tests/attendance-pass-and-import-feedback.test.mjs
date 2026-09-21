import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("ATTENDANCE-PASS: studentBarcodeCard.js includes renderStudentAttendancePassHtml with screenshot banner", () => {
  const filePath = path.resolve(__dirname, "../../web/src/utils/studentBarcodeCard.js");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(content.includes("export function renderStudentAttendancePassHtml"), "Must export renderStudentAttendancePassHtml");
  assert.ok(content.includes("احفظ هذه الشاشة (سكرين شوت) للدخول بها إلى الدرس"), "Must contain screenshot banner");
  assert.ok(content.includes("كود الطالب:"), "Must display student code");
  assert.ok(content.includes("generateBarcode128Svg"), "Must generate barcode SVG");
  assert.ok(content.includes("renderAttendancePass: renderStudentAttendancePassHtml"), "Must expose on window.centrlyBarcodeCard");
});

test("ATTENDANCE-PASS: filters out group name when assigned to subject", () => {
  const filePath = path.resolve(__dirname, "../../web/src/utils/studentBarcodeCard.js");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(
    content.includes('subjectName.includes("مجموع")') || content.includes("subjectName.includes('مجموع')"),
    "Must filter out subject if it contains 'مجموع'"
  );
});

test("STUDENT-PORTAL: Tab 4 uses simple attendance pass and barcoded name", () => {
  const filePath = path.resolve(__dirname, "../../web/src/components/StudentPortalView.js");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(content.includes("renderStudentAttendancePassHtml"), "Must import and use renderStudentAttendancePassHtml");
  assert.ok(content.includes("<span>باركود الحضور</span>"), "Tab 4 must be named باركود الحضور");
  assert.ok(!content.includes("<span>كارت الحضور</span>"), "Must not name tab كارت الحضور");
});

test("STUDENT-CARDS: live card preview and table preview column are removed", () => {
  const filePath = path.resolve(__dirname, "../../web/src/components/StudentCardsView.js");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(!content.includes("معاينة مباشرة لتصميم الكارت الجديد"), "Card mockup preview must be removed");
  assert.ok(!content.includes("<th>معاينة</th>"), "Table preview column header must be removed");
  assert.ok(!content.includes("window.centrlyApp.previewSpecificCard"), "Table preview button must be removed from order cards");
});

test("STUDENT-DIRECTORY: previewSpecificCard uses attendance pass screen", () => {
  const filePath = path.resolve(__dirname, "../../web/src/app.js");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(content.includes("renderStudentAttendancePassHtml(studentObj)"), "previewSpecificCard must use renderStudentAttendancePassHtml");
  assert.ok(content.includes("باركود حضور الطالب:"), "Modal title should be باركود حضور الطالب");
});

test("IMPORT-STUDENTS: in-modal loading spinner and progress bar implemented", () => {
  const filePath = path.resolve(__dirname, "../../web/src/app.js");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(content.includes("جاري استيراد وحفظ بيانات الطلاب..."), "Modal must display loading message");
  assert.ok(content.includes("spinner"), "Modal must show spinner animation");
  assert.ok(content.includes("جاري الحفظ في النظام... ⏳"), "Modal footer must disable button with progress text");
});

test("IMPORT-STUDENTS: 10-digit Egyptian numbers missing leading 0 are auto-fixed", () => {
  const filePath = path.resolve(__dirname, "../../web/src/app.js");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(
    content.includes("digits.length === 10") && content.includes("digits = '0' + digits"),
    "normalizeImportPhone must prepend 0 for 10-digit Egyptian numbers"
  );
});

test("BACKEND: normalizePhoneNumber in import.ts formats 10-digit numbers correctly", async () => {
  const { normalizePhoneNumber, isValidEgyptianPhone } = await import("../dist/features/students/import.js");

  const normalized = normalizePhoneNumber("1012345678");
  assert.equal(normalized, "01012345678", "10-digit number without 0 must become 01012345678");
  assert.equal(isValidEgyptianPhone(normalized), true, "Must be valid Egyptian phone");

  const normalizedWith20 = normalizePhoneNumber("+201123456789");
  assert.equal(normalizedWith20, "01123456789");
  assert.equal(isValidEgyptianPhone(normalizedWith20), true);
});

test("AUTH: AuthScreens.js removes center field and account type selection from signup form", () => {
  const filePath = path.resolve(__dirname, "../../web/src/components/AuthScreens.js");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(!content.includes('<select id="signupAccountType"'), "Account type select dropdown must be removed");
  assert.ok(!content.includes('value="center"'), "Center option must be removed from signup");
  assert.ok(!content.includes('id="roleFieldsCenter"'), "Center role fields block must be removed");
  assert.ok(!content.includes('id="signupCenterName"'), "Center name input field must be removed");
  assert.ok(!content.includes('id="signupCenterOwnerName"'), "Center owner name input field must be removed");

  assert.ok(
    content.includes('<input type="hidden" id="signupAccountType" value="teacher">'),
    "Must include hidden input signupAccountType with default value teacher"
  );
  assert.ok(content.includes('id="signupName"'), "Must retain teacher name input");
  assert.ok(content.includes('id="signupSubject"'), "Must retain teacher subject input");
});

test("WEB SYNTAX: studentBarcodeCard.js and AuthScreens.js import cleanly without syntax errors", async () => {
  const cardModule = await import("../../web/src/utils/studentBarcodeCard.js");
  assert.ok(typeof cardModule.renderStudentBarcodeCardHtml === "function", "renderStudentBarcodeCardHtml must be a function");
  assert.ok(typeof cardModule.renderStudentAttendancePassHtml === "function", "renderStudentAttendancePassHtml must be a function");
  assert.ok(typeof cardModule.generateBarcode128Svg === "function", "generateBarcode128Svg must be a function");

  const authModule = await import("../../web/src/components/AuthScreens.js");
  assert.ok(typeof authModule.renderAuthScreens === "function", "renderAuthScreens must be a function");
});

test("WEB DOM: apps/web/index.html and root index.html must contain <div id=\"app\"></div>", () => {
  const webIndexPath = path.resolve(__dirname, "../../web/index.html");
  const webContent = fs.readFileSync(webIndexPath, "utf-8");
  assert.ok(webContent.includes('<div id="app"></div>'), "apps/web/index.html must contain <div id=\"app\"></div>");

  const rootIndexPath = path.resolve(__dirname, "../../../index.html");
  const rootContent = fs.readFileSync(rootIndexPath, "utf-8");
  assert.ok(rootContent.includes('<div id="app"></div>'), "Root index.html must contain <div id=\"app\"></div>");
});

test("OFFLINE-ATTENDANCE: app.js contains persistent queue methods and non-destructive sync", () => {
  const appPath = path.resolve(__dirname, "../../web/src/app.js");
  const appContent = fs.readFileSync(appPath, "utf-8");

  assert.ok(appContent.includes("getOfflineAttendanceQueue()"), "Must define getOfflineAttendanceQueue");
  assert.ok(appContent.includes("saveOfflineAttendanceQueue("), "Must define saveOfflineAttendanceQueue");
  assert.ok(appContent.includes("enqueueOfflineAttendance("), "Must define enqueueOfflineAttendance");
  assert.ok(appContent.includes("flushOfflineAttendanceQueue()"), "Must define flushOfflineAttendanceQueue");
  assert.ok(appContent.includes("toggleStudentAttendance("), "Must define toggleStudentAttendance");

  // Verify non-destructive sync in syncAndResumeServerSession
  assert.ok(appContent.includes("localAttendanceMap"), "syncAndResumeServerSession must preserve localAttendanceMap");
  assert.ok(appContent.includes("isLocallyAttended"), "syncAndResumeServerSession must check isLocallyAttended");
  assert.ok(appContent.includes("window.addEventListener('online'"), "Must listen for online event");
  assert.ok(appContent.includes("window.addEventListener('offline'"), "Must listen for offline event");
});

test("OFFLINE-ATTENDANCE: SessionsView.js displays offline indicator and toggle button", () => {
  const sessionsViewPath = path.resolve(__dirname, "../../web/src/components/SessionsView.js");
  const content = fs.readFileSync(sessionsViewPath, "utf-8");

  assert.ok(content.includes("isBrowserOffline"), "SessionsView must check isBrowserOffline");
  assert.ok(content.includes("وضع عدم الاتصال (Offline Mode)"), "SessionsView must show offline mode banner");
  assert.ok(content.includes("toggleStudentAttendance"), "SessionsView status badge must call toggleStudentAttendance");
});



