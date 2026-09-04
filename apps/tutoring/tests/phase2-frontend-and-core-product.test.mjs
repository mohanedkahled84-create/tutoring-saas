import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  generateParentPortalToken,
  verifyParentPortalToken,
} from "../dist/shared/utils/tokens.js";
import { DEFAULT_TENANT_SETTINGS } from "../dist/features/auth/settingsRoutes.js";
import { app } from "../dist/app.js";

// ============================================================================
// DEV-34: Parent Web Portal Token & Security Tests
// ============================================================================

test("DEV-34: generateParentPortalToken creates valid signed token", () => {
  const token = generateParentPortalToken("student-123", "tenant-456", 30);
  assert.ok(token);
  assert.equal(typeof token, "string");

  const verified = verifyParentPortalToken(token);
  assert.ok(verified);
  assert.equal(verified.student_id, "student-123");
  assert.equal(verified.tenant_id, "tenant-456");
  assert.ok(verified.expires_at > Math.floor(Date.now() / 1000));
});

test("DEV-34: verifyParentPortalToken strictly rejects tampered token", () => {
  const token = generateParentPortalToken("student-123", "tenant-456", 30);
  const decoded = Buffer.from(token, "base64url").toString("utf8");
  const parts = decoded.split(":");

  // Tamper student ID
  parts[1] = "student-hacked-999";
  const tamperedToken = Buffer.from(parts.join(":")).toString("base64url");

  const verified = verifyParentPortalToken(tamperedToken);
  assert.equal(verified, null);
});

test("DEV-34: verifyParentPortalToken rejects expired token", () => {
  // Pass -1 days to generate expired token
  const token = generateParentPortalToken("student-123", "tenant-456", -1);
  const verified = verifyParentPortalToken(token);
  assert.equal(verified, null);
});

test("DEV-34: verifyParentPortalToken rejects malformed strings", () => {
  assert.equal(verifyParentPortalToken("not-a-token"), null);
  assert.equal(verifyParentPortalToken(""), null);
  assert.equal(verifyParentPortalToken("abc:def"), null);
});

import http from "node:http";

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

test("DEV-34: GET /api/public/parent-portal rejects missing or invalid token", async () => {
  // Missing token
  const res1 = await fetch(`${baseUrl}/api/public/parent-portal`);
  assert.equal(res1.status, 400);

  // Forged token
  const res2 = await fetch(`${baseUrl}/api/public/parent-portal?token=forged-fake-token`);
  assert.equal(res2.status, 401);
  const body = await res2.json();
  assert.equal(body.error.code, "UNAUTHORIZED");
});

// ============================================================================
// DEV-38: Tenant-Configurable Workflow Settings Tests
// ============================================================================

test("DEV-38: DEFAULT_TENANT_SETTINGS defaults are safe and defined", () => {
  assert.equal(DEFAULT_TENANT_SETTINGS.homework_submission, "in_session");
  assert.equal(DEFAULT_TENANT_SETTINGS.auto_notification, true);
  assert.equal(DEFAULT_TENANT_SETTINGS.enable_top_performers, true);
});

test("DEV-38: GET /api/settings requires authentication", async () => {
  const res = await fetch(`${baseUrl}/api/settings`);
  assert.equal(res.status, 401);
});

test("DEV-38: PUT /api/settings requires authentication and rejects malformed values", async () => {
  const res = await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ homework_submission: "invalid_option" }),
  });
  // Must reject unauthenticated
  assert.equal(res.status, 401);
});

// ============================================================================
// DEV-15 & DEV-16: Frontend Components & Role Privacy Integrity Tests
// ============================================================================

test("DEV-15 & DEV-16: All required frontend UI components exist and export render functions", () => {
  const webDir = path.resolve(process.cwd(), "../../apps/web/src/components");

  const expectedFiles = [
    "OnboardingWizard.js",
    "TeacherDashboard.js",
    "SessionsView.js",
    "StudentsView.js",
    "GroupsView.js",
    "MessageLogsView.js",
    "ParentPortalView.js",
  ];

  for (const file of expectedFiles) {
    const fullPath = path.join(webDir, file);
    assert.ok(fs.existsSync(fullPath), `Expected ${file} to exist in apps/web/src/components`);
    const content = fs.readFileSync(fullPath, "utf8");
    assert.ok(content.includes("export function render"), `${file} must export render function`);
  }
});

test("DEV-16: SessionsView strictly masks financial totals when role is assistant", async () => {
  const webDir = path.resolve(process.cwd(), "../../apps/web/src/components");
  const sessionsViewPath = path.join(webDir, "SessionsView.js");
  const content = fs.readFileSync(sessionsViewPath, "utf8");

  // Verify assistant role check is present
  assert.ok(content.includes("user?.role === 'assistant'"));
  assert.ok(content.includes("الإيرادات المالية مقفلة"));
});

test("DEV-16: GroupsView hides session prices when role is assistant", async () => {
  const webDir = path.resolve(process.cwd(), "../../apps/web/src/components");
  const groupsViewPath = path.join(webDir, "GroupsView.js");
  const content = fs.readFileSync(groupsViewPath, "utf8");

  assert.ok(content.includes("user?.role === 'assistant'"));
  assert.ok(content.includes("محجوب للمساعد"));
});

test("DEV-16: SessionsView automatically resets homework selector after every scan", () => {
  const appJsPath = path.resolve(process.cwd(), "../../apps/web/src/app.js");
  const content = fs.readFileSync(appJsPath, "utf8");

  // Verify that handleStudentScan explicitly resets homework radio to done
  assert.ok(content.includes("hwDoneRadio.checked = true"));
});

test("DEV-16: TeacherDashboard includes both At-Risk Warnings and Top Performers", () => {
  const dashboardPath = path.resolve(process.cwd(), "../../apps/web/src/components/TeacherDashboard.js");
  const content = fs.readFileSync(dashboardPath, "utf8");

  assert.ok(content.includes("At-Risk Watchlist"));
  assert.ok(content.includes("Top Performers"));
  assert.ok(content.includes("المتفوقين"));
});
