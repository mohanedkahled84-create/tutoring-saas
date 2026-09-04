import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../dist/app.js";
import { evaluateNotificationDecision } from "../dist/features/attendance/index.js";

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

test("GET /health returns healthy status", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, "healthy");
  assert.ok(json.timestamp);
});

test("DEV-API.1: Unauthenticated request to protected endpoints returns 401", async () => {
  const endpoints = ["/api/students", "/api/groups", "/api/sessions/test-id"];

  for (const endpoint of endpoints) {
    const res = await fetch(`${baseUrl}${endpoint}`);
    assert.equal(res.status, 401, `Endpoint ${endpoint} should reject without token`);
    const json = await res.json();
    assert.match(json.error.message, /Missing or invalid authentication/i);
    assert.equal(json.error.code, "UNAUTHORIZED");
  }
});

test("DEV-API.1: Invalid Bearer token returns 401", async () => {
  const res = await fetch(`${baseUrl}/api/students`, {
    headers: {
      Authorization: "Bearer invalid-dummy-token-123",
    },
  });
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.match(json.error.message, /Invalid or expired/i);
  assert.equal(json.error.code, "UNAUTHORIZED");
});

test("DEV-API.3: Notification decision logic classifies correctly", () => {
  // 1. Absent student -> attendance_absent
  assert.equal(evaluateNotificationDecision(false, null), "attendance_absent");
  assert.equal(evaluateNotificationDecision(false, "Excused"), "attendance_absent");

  // 2. Attended + comment -> attendance_present_comment
  assert.equal(
    evaluateNotificationDecision(true, "Great job today in physics!"),
    "attendance_present_comment"
  );

  // 3. Attended + empty/null comment -> none (no notification triggered)
  assert.equal(evaluateNotificationDecision(true, null), "none");
  assert.equal(evaluateNotificationDecision(true, ""), "none");
  assert.equal(evaluateNotificationDecision(true, "   "), "none");
});
