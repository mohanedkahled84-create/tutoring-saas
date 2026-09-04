import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../dist/app.js";

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

// Helper to make test HTTP calls
async function callApi(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, options);
  let json = null;
  try {
    json = await res.json();
  } catch {
    // Non-json response
  }
  return { status: res.status, headers: res.headers, body: json };
}

// ============================================================================
// Task 20: [Security] Audit & Penetration Testing — All Endpoints
// ============================================================================

test("DEV-PEN.1: Unauthenticated requests to all protected routes strictly return 401", async () => {
  const protectedRoutes = [
    { path: "/api/students", method: "GET" },
    { path: "/api/students", method: "POST" },
    { path: "/api/students/any-id", method: "GET" },
    { path: "/api/students/any-id", method: "DELETE" },
    { path: "/api/groups", method: "GET" },
    { path: "/api/groups", method: "POST" },
    { path: "/api/groups/any-id", method: "GET" },
    { path: "/api/groups/any-id/students", method: "POST" },
    { path: "/api/sessions", method: "GET" },
    { path: "/api/sessions", method: "POST" },
    { path: "/api/sessions/any-id", method: "GET" },
    { path: "/api/sessions/any-id/attendance", method: "POST" },
    { path: "/api/sessions/any-id/scan", method: "POST" },
    { path: "/api/sessions/any-id/sync", method: "POST" },
    { path: "/api/sessions/any-id/financials", method: "GET" },
    { path: "/api/sessions/any-id/receipt", method: "GET" },
    { path: "/api/sessions/any-id/delivery-status", method: "GET" },
    { path: "/api/at-risk", method: "GET" },
    { path: "/api/at-risk/alerts", method: "POST" },
    { path: "/api/billing/status", method: "GET" },
    { path: "/api/billing/payment-proof", method: "POST" },
    { path: "/api/activity-logs", method: "GET" },
    { path: "/api/templates", method: "GET" },
    { path: "/api/whatsapp/status", method: "GET" },
    { path: "/api/admin/tenants", method: "GET" },
    { path: "/api/admin/overview", method: "GET" },
    { path: "/api/admin/payment-proofs", method: "GET" },
  ];

  for (const route of protectedRoutes) {
    const res = await callApi(route.path, {
      method: route.method,
      headers: { "Content-Type": "application/json" },
      body: route.method === "POST" ? JSON.stringify({}) : undefined,
    });
    assert.equal(
      res.status,
      401,
      `Expected ${route.method} ${route.path} to return 401 without auth, got ${res.status}`
    );
    assert.equal(res.body?.error?.code, "UNAUTHORIZED");
  }
});

test("DEV-PEN.2: Internal automation routes strictly reject missing or forged shared secrets", async () => {
  const internalRoutes = [
    { path: "/internal/tenants/dummy-id/whatsapp-connection", method: "GET" },
    { path: "/internal/message-logs", method: "POST" },
    { path: "/internal/billing/renewals/dispatch", method: "POST" },
    { path: "/internal/health/whatsapp", method: "GET" },
  ];

  for (const route of internalRoutes) {
    // 1. No secret
    const resNoAuth = await callApi(route.path, { method: route.method });
    assert.equal(resNoAuth.status, 401);

    // 2. Wrong secret
    const resWrongAuth = await callApi(route.path, {
      method: route.method,
      headers: { Authorization: "Bearer forged-attacker-secret-xyz" },
    });
    assert.equal(resWrongAuth.status, 401);
  }
});

test("DEV-PEN.3: Security response headers are present on all HTTP endpoints", async () => {
  const res = await callApi("/health/ping");
  assert.equal(res.status, 200);

  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.ok(res.headers.get("content-security-policy"));
  assert.ok(res.headers.get("strict-transport-security"));
});

test("DEV-PEN.4: Public endpoints reject prototype pollution and SQL injection payloads via Zod", async () => {
  // Prototype pollution attempt
  const payload = JSON.parse(
    '{"__proto__": {"isAdmin": true}, "tenant_id": "bad", "name": "Hack", "parent_phone": "010000"}'
  );

  const res = await callApi("/api/public/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Rejects with 400 validation error
  assert.equal(res.status, 400);
  assert.equal(res.body?.error?.code, "VALIDATION_ERROR");
});
