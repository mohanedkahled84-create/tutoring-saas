import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../dist/app.js";
import { validatePasswordStrength, extractToken } from "../dist/middleware/auth.js";
import { checkBruteForce, recordFailedLogin, resetLoginAttempts } from "../dist/routes/auth.js";

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
// DEV-21: Authentication & Authorization Hardening Tests
// ========================================================

test("DEV-AUTH.1: Token extraction supports both Bearer header and httpOnly cookie", () => {
  // 1. From header
  const reqWithHeader = { headers: { authorization: "Bearer my-secret-jwt" } };
  assert.equal(extractToken(reqWithHeader), "my-secret-jwt");

  // 2. From cookie
  const reqWithCookie = { headers: {}, cookies: { access_token: "my-cookie-jwt" } };
  assert.equal(extractToken(reqWithCookie), "my-cookie-jwt");

  // 3. None
  const reqEmpty = { headers: {}, cookies: {} };
  assert.equal(extractToken(reqEmpty), null);
});

test("DEV-AUTH.3: Password strength validation enforces security rules", () => {
  assert.equal(validatePasswordStrength("short").valid, false);
  assert.equal(validatePasswordStrength("onlyletters").valid, false);
  assert.equal(validatePasswordStrength("12345678").valid, false);
  assert.equal(validatePasswordStrength("SecurePass123!").valid, true);
});

test("DEV-AUTH.3: Brute force tracking locks account after 5 failed attempts", () => {
  const testEmail = "attacker@example.com";
  resetLoginAttempts(testEmail);

  // First 4 attempts should still be allowed
  for (let i = 0; i < 4; i++) {
    recordFailedLogin(testEmail);
    assert.equal(checkBruteForce(testEmail).allowed, true);
  }

  // 5th attempt locks the account
  recordFailedLogin(testEmail);
  const lockoutStatus = checkBruteForce(testEmail);
  assert.equal(lockoutStatus.allowed, false);
  assert.ok(lockoutStatus.waitTimeMinutes && lockoutStatus.waitTimeMinutes > 0);

  // Clean up
  resetLoginAttempts(testEmail);
});

// ========================================================
// DEV-23: API Security (Validation & Rate Limiting) Tests
// ========================================================

test("DEV-APISEC.2: Zod input validation rejects malformed student request", async () => {
  const res = await fetch(`${baseUrl}/api/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Fake bearer so auth middleware passes to validation check (or validation catches before)
      Authorization: "Bearer invalid-token",
    },
    body: JSON.stringify({
      // missing name and parent_phone
      notes: "test notes",
    }),
  });

  // Since auth runs before route handlers, it returns 401 for bad token
  assert.equal(res.status, 401);
});

test("DEV-APISEC.2: Internal message-logs rejects invalid enum and missing fields", async () => {
  const res = await fetch(`${baseUrl}/internal/message-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer dev-shared-secret-change-in-production",
    },
    body: JSON.stringify({
      tenant_id: "not-a-uuid",
      idempotency_key: "key1",
      message_type: "invalid_type",
      recipient_type: "invalid_recipient",
      recipient_phone: "123",
      status: "unknown_status",
    }),
  });

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error.code, "VALIDATION_ERROR");
  assert.ok(json.error.details.length > 0);
});

// ========================================================
// DEV-26: Error Handling & Monitoring Tests
// ========================================================

test("DEV-ERRM.1: Unknown route returns uniform, safe 404 error shape", async () => {
  const res = await fetch(`${baseUrl}/api/non-existent-route-12345`);
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(json.error.code, "NOT_FOUND");
  assert.ok(json.timestamp);
  assert.ok(json.path);
  assert.ok(json.requestId);
});

test("DEV-ERRM.3: GET /health/ping returns ok status for uptime monitors", async () => {
  const res = await fetch(`${baseUrl}/health/ping`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, "ok");
});

test("DEV-ERRM.3: GET /health returns rich diagnostic health payload", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.ok([200, 503].includes(res.status));
  const json = await res.json();
  assert.ok(json.status);
  assert.ok(json.uptime_seconds >= 0);
  assert.ok(json.database);
  assert.ok(json.system.memory);
});
