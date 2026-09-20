import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import bcrypt from "bcryptjs";
import { FakeTenantsRepository } from "../dist/features/auth/repository.js";
import { settingsRouter } from "../dist/features/auth/settingsRoutes.js";

// ============================================================================
// C-03 & C-04: PIN Bcrypt Storage & Brute-Force Lockout Audit Test
// ============================================================================

test("C-03 & C-04: Bcrypt storage and 5-attempt brute-force lockout protection", async () => {
  const fakeTenantsRepo = new FakeTenantsRepository();
  const app = express();
  app.use(express.json());

  const testUserId = "user-audit-c04-test";
  const testTenantId = "tenant-audit-c04";

  let currentUser = {
    id: testUserId,
    email: "audit-tester@example.com",
    tenant_id: testTenantId,
    role: "owner",
    has_security_pin: false,
  };

  app.use((req, res, next) => {
    req.user = currentUser ? { ...currentUser } : null;
    req.services = { tenants: fakeTenantsRepo };
    next();
  });

  app.use("/api/settings", settingsRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // Step 1: Set new PIN '4321'
    const setRes = await fetch(`${baseUrl}/api/settings/security-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "4321" }),
    });
    assert.equal(setRes.status, 200);
    const setBody = await setRes.json();
    assert.equal(setBody.success, true);

    // C-03: Verify PIN is stored as a bcrypt hash ($2a$ or $2b$) and NOT plaintext
    const pinSec = await fakeTenantsRepo.getUserPinSecurity(testUserId);
    assert.ok(pinSec && pinSec.hash, "PIN must exist in security store");
    assert.match(pinSec.hash, /^\$2[ab]\$\d{2}\$/, "Stored PIN must be a valid bcrypt hash");
    assert.notEqual(pinSec.hash, "4321", "Stored PIN must NEVER be plaintext");
    assert.ok(await bcrypt.compare("4321", pinSec.hash), "Bcrypt hash must match the original PIN");

    // Step 2: Failed attempts 1 through 4
    for (let i = 1; i <= 4; i++) {
      const failRes = await fetch(`${baseUrl}/api/settings/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "9999" }),
      });
      assert.equal(failRes.status, 200, `Attempt ${i} should return 200 before reaching max limit`);
      const failBody = await failRes.json();
      assert.equal(failBody.valid, false);
      assert.equal(failBody.error.remaining_attempts, 5 - i);
    }

    // Step 3: Attempt 5 triggers automatic 15-minute lockout (HTTP 423 PIN_LOCKED)
    const lockRes = await fetch(`${baseUrl}/api/settings/verify-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "9999" }),
    });
    assert.equal(lockRes.status, 423, "5th failed attempt must return HTTP 423 Locked");
    const lockBody = await lockRes.json();
    assert.equal(lockBody.valid, false);
    assert.equal(lockBody.error.code, "PIN_LOCKED");
    assert.ok(lockBody.error.locked_until, "Must provide locked_until timestamp");
    assert.ok(lockBody.error.retry_after_seconds > 0, "Must provide retry_after_seconds");

    // Step 4: Subsequent request while locked must be immediately rejected with HTTP 423 even with correct PIN
    const whileLockedRes = await fetch(`${baseUrl}/api/settings/verify-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "4321" }),
    });
    assert.equal(whileLockedRes.status, 423, "Account must reject all attempts while locked");
    const whileLockedBody = await whileLockedRes.json();
    assert.equal(whileLockedBody.error.code, "PIN_LOCKED");

    // Step 5: Simulate lockout expiration and successful PIN entry resets failed counter
    await fakeTenantsRepo.resetFailedPinAttempts(testUserId);

    // Step 6: Verify correct PIN with Arabic numerals (٤٣٢١) unlocks and resets counter
    const arabicRes = await fetch(`${baseUrl}/api/settings/verify-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "٤٣٢١" }),
    });
    assert.equal(arabicRes.status, 200);
    const arabicBody = await arabicRes.json();
    assert.equal(arabicBody.valid, true, "Arabic numerals (٤٣٢١) must unlock successfully");

    const pinSecReset = await fakeTenantsRepo.getUserPinSecurity(testUserId);
    assert.equal(pinSecReset.failed_attempts, 0, "Failed attempts counter must reset to 0 after success");
  } finally {
    server.close();
  }
});
