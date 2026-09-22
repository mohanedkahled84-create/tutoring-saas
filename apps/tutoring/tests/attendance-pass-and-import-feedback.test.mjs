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

test("WEB DOM: apps/web/index.html and root index.html must contain <div id=\"app\"></div> and <base href=\"/\">", () => {
  const webIndexPath = path.resolve(__dirname, "../../web/index.html");
  const webContent = fs.readFileSync(webIndexPath, "utf-8");
  assert.ok(webContent.includes('<div id="app"></div>'), "apps/web/index.html must contain <div id=\"app\"></div>");
  assert.ok(webContent.includes('<base href="/">'), "apps/web/index.html must contain <base href=\"/\">");

  const rootIndexPath = path.resolve(__dirname, "../../../index.html");
  const rootContent = fs.readFileSync(rootIndexPath, "utf-8");
  assert.ok(rootContent.includes('<div id="app"></div>'), "Root index.html must contain <div id=\"app\"></div>");
  assert.ok(rootContent.includes('<base href="/">'), "Root index.html must contain <base href=\"/\">");

  const vercelPath = path.resolve(__dirname, "../../../vercel.json");
  const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, "utf-8"));
  const hasFallback = (vercelConfig.routes && vercelConfig.routes.some(r => r.dest === "/index.html")) ||
                      (vercelConfig.rewrites && vercelConfig.rewrites.some(r => r.destination === "/index.html"));
  assert.ok(hasFallback, "vercel.json must have SPA fallback rewrite to /index.html for /portal to work");
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

test("NAVBAR-MOBILE: sidebarToggle is non-wrapping, flex-shrink 0, and live badge is responsive", () => {
  const navbarPath = path.resolve(__dirname, "../../web/src/components/Navbar.js");
  const navbarContent = fs.readFileSync(navbarPath, "utf-8");

  assert.ok(navbarContent.includes("renderNavLiveBadgeHtml"), "Navbar.js must export renderNavLiveBadgeHtml");
  assert.ok(navbarContent.includes("flex-wrap: nowrap;"), "Topbar container must not wrap items");
  assert.ok(navbarContent.includes("id=\"sidebarToggle\""), "Navbar must contain sidebarToggle");
  assert.ok(navbarContent.includes("flex-shrink: 0;"), "sidebarToggle must have flex-shrink: 0");

  const cssPath = path.resolve(__dirname, "../../web/src/styles/main.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");
  assert.ok(/#sidebarToggle\s*\{\s*display:\s*inline-flex\s*!important;\s*flex-shrink:\s*0\s*!important;/i.test(cssContent), "main.css must enforce inline-flex and flex-shrink 0 for sidebarToggle on mobile");
  assert.ok(cssContent.includes(".nav-live-session-btn"), "main.css must define .nav-live-session-btn");
  assert.ok(cssContent.includes(".nav-live-text-mobile"), "main.css must define mobile compact live badge text");
  assert.ok(cssContent.includes(".nav-live-text-desktop"), "main.css must define desktop live badge text");

  const appPath = path.resolve(__dirname, "../../web/src/app.js");
  const appContent = fs.readFileSync(appPath, "utf-8");
  assert.ok(appContent.includes("renderNavLiveBadgeHtml"), "app.js must import and use renderNavLiveBadgeHtml");
});

test("SESSION-RESILIENCE: Proactive session refresher, Web Lock deduplication, and stateless Supabase client", () => {
  const appPath = path.resolve(__dirname, "../../web/src/app.js");
  const appContent = fs.readFileSync(appPath, "utf-8");

  assert.ok(appContent.includes("startProactiveSessionRefresher()"), "app.js must define and call startProactiveSessionRefresher");
  assert.ok(appContent.includes("isJwtExpired(token, 900)"), "Proactive refresher must check expiration buffer");
  assert.ok(appContent.includes("window.addEventListener('focus'"), "Must check on window focus");
  assert.ok(appContent.includes("window.addEventListener('storage'"), "Must sync across tabs on storage event");

  const apiPath = path.resolve(__dirname, "../../web/src/services/api.js");
  const apiContent = fs.readFileSync(apiPath, "utf-8");
  assert.ok(apiContent.includes("export function isJwtExpired"), "api.js must export isJwtExpired");
  assert.ok(apiContent.includes("centrly_auth_refresh_lock"), "api.js must use Web Locks for multi-tab deduplication");

  const supabasePath = path.resolve(__dirname, "../src/supabase.ts");
  const supabaseContent = fs.readFileSync(supabasePath, "utf-8");
  assert.ok(/supabasePublic[\s\S]*persistSession:\s*false/.test(supabaseContent), "supabasePublic must be stateless with persistSession: false");

  const routesPath = path.resolve(__dirname, "../src/features/auth/routes.ts");
  const routesContent = fs.readFileSync(routesPath, "utf-8");
  assert.ok(routesContent.includes("REFRESH_TEMPORARY_FAILURE"), "Auth refresh route must not return 401 on transient server errors");
});

test("IMPORT-GROUP-SELECTION: Sheet import and add student modals support group choice and + New Group creation", () => {
  const appPath = path.resolve(__dirname, "../../web/src/app.js");
  const appContent = fs.readFileSync(appPath, "utf-8");

  assert.ok(appContent.includes("renderGroupOptionsForImport(selectedGroupId"), "app.js must define renderGroupOptionsForImport");
  assert.ok(appContent.includes("value=\"__NEW_GROUP__\""), "Group options must include __NEW_GROUP__ choice");
  assert.ok(appContent.includes("إضافة مجموعة جديدة الآن..."), "Group options must display + New Group option label");

  // Step 1 modal includes dropdown and quick creator
  assert.ok(appContent.includes("id=\"importGroupId\""), "Step 1 must have importGroupId select element");
  assert.ok(appContent.includes("quickGroupCreatorStep1"), "Step 1 must include quickGroupCreatorStep1 container");
  assert.ok(appContent.includes("executeQuickCreateGroupForImport(1)"), "Step 1 must allow executing quick group creation");

  // Step 2 modal includes interactive dropdown and quick creator
  assert.ok(appContent.includes("id=\"importStep2GroupId\""), "Step 2 must have interactive importStep2GroupId select element");
  assert.ok(appContent.includes("quickGroupCreatorStep2"), "Step 2 must include quickGroupCreatorStep2 container");
  assert.ok(appContent.includes("executeQuickCreateGroupForImport(2)"), "Step 2 must allow executing quick group creation in Step 2");

  // executeImportStudents dynamically reads from Step 2
  assert.ok(appContent.includes("document.getElementById('importStep2GroupId')"), "executeImportStudents must read selected group from Step 2");

  // Single student modal also supports quick group creation
  assert.ok(appContent.includes("quickGroupCreatorSingleStudent"), "Single student modal must have quickGroupCreatorSingleStudent");
  assert.ok(appContent.includes("executeQuickCreateGroupForSingleStudent()"), "Single student modal must support executeQuickCreateGroupForSingleStudent");

  // GroupsView includes direct import sheet action on cards
  const groupsViewPath = path.resolve(__dirname, "../../web/src/components/GroupsView.js");
  const groupsViewContent = fs.readFileSync(groupsViewPath, "utf-8");
  assert.ok(groupsViewContent.includes("openImportModal('${escapeHtml(g.id)}')"), "GroupsView cards must have direct openImportModal button");
});


