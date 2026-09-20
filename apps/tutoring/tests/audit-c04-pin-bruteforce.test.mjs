import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import bcrypt from 'bcryptjs';
import { FakeTenantsRepository } from '../dist/features/auth/repository.js';
import { settingsRouter } from '../dist/features/auth/settingsRoutes.js';

test('C-03 & C-04: Financial PIN bcrypt hashing & brute-force lockout protection', async () => {
  const fakeTenantsRepo = new FakeTenantsRepository();
  const app = express();
  app.use(express.json());

  const testUserId = 'user-pin-test-audit-001';
  let currentUser = {
    id: testUserId,
    email: 'pin-audit@centrly.app',
    tenant_id: 'tenant-pin-audit',
    role: 'owner',
    has_security_pin: false,
  };

  app.use((req, res, next) => {
    req.user = currentUser ? { ...currentUser } : null;
    req.services = { tenants: fakeTenantsRepo };
    next();
  });

  app.use('/api/settings', settingsRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Initial state: has_pin must be false
    const resInit = await fetch(`${baseUrl}/api/settings/security-pin`);
    assert.equal(resInit.status, 200);
    const bodyInit = await resInit.json();
    assert.equal(bodyInit.has_pin, false);
    assert.equal(bodyInit.financial_pin, undefined, 'financial_pin must NEVER be returned');
    assert.equal(bodyInit.hash, undefined, 'PIN hash must NEVER be returned');

    // 2. Set new PIN (C-03: stored as bcrypt hash)
    const resSet = await fetch(`${baseUrl}/api/settings/security-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '4826' }),
    });
    assert.equal(resSet.status, 200);
    const bodySet = await resSet.json();
    assert.equal(bodySet.success, true);

    // Verify stored PIN is bcrypt hashed
    const secData = await fakeTenantsRepo.getUserPinSecurity(testUserId);
    assert.ok(secData && secData.hash, 'PIN security record must exist');
    assert.notEqual(secData.hash, '4826', 'PIN must NOT be stored in plaintext');
    assert.ok(secData.hash.startsWith('$2a$') || secData.hash.startsWith('$2b$'), 'PIN must be bcrypt hash');
    assert.ok(bcrypt.compareSync('4826', secData.hash), 'Bcrypt hash must match the original PIN');

    // 3. GET /security-pin returns only { has_pin: true }
    const resCheck = await fetch(`${baseUrl}/api/settings/security-pin`);
    const bodyCheck = await resCheck.json();
    assert.equal(bodyCheck.has_pin, true);
    assert.equal(bodyCheck.financial_pin, undefined, 'financial_pin must NEVER be exposed');
    assert.equal(bodyCheck.hash, undefined, 'hash must NEVER be exposed');

    // 4. Test C-04: Brute force lockout after 5 failed attempts
    for (let i = 1; i <= 4; i++) {
      const resFail = await fetch(`${baseUrl}/api/settings/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '0000' }),
      });
      assert.equal(resFail.status, 200, `Attempt ${i} should return status 200 with valid: false`);
      const bodyFail = await resFail.json();
      assert.equal(bodyFail.valid, false);
      assert.equal(bodyFail.error.code, 'INVALID_PIN');
      assert.equal(bodyFail.error.remaining_attempts, 5 - i);
    }

    // 5th failed attempt: MUST trigger lockout (HTTP 423 PIN_LOCKED)
    const resLock = await fetch(`${baseUrl}/api/settings/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '0000' }),
    });
    assert.equal(resLock.status, 423, '5th failed attempt must return HTTP 423 PIN_LOCKED');
    const bodyLock = await resLock.json();
    assert.equal(bodyLock.valid, false);
    assert.equal(bodyLock.error.code, 'PIN_LOCKED');
    assert.ok(bodyLock.error.locked_until, 'locked_until timestamp must be provided');
    assert.ok(bodyLock.error.retry_after_seconds > 0, 'retry_after_seconds must be positive');

    // 6th attempt (even with correct PIN): MUST remain blocked while locked
    const resWhileLocked = await fetch(`${baseUrl}/api/settings/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '4826' }),
    });
    assert.equal(resWhileLocked.status, 423, 'Request while locked must return HTTP 423 even with correct PIN');

    // Reset lock to test successful verification resets failed counter
    await fakeTenantsRepo.resetFailedPinAttempts(testUserId);

    const resCorrect = await fetch(`${baseUrl}/api/settings/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '4826' }),
    });
    assert.equal(resCorrect.status, 200);
    const bodyCorrect = await resCorrect.json();
    assert.equal(bodyCorrect.valid, true);

    const secDataAfterSuccess = await fakeTenantsRepo.getUserPinSecurity(testUserId);
    assert.equal(secDataAfterSuccess.failed_attempts, 0, 'Successful PIN verification must reset failed attempts');
    assert.equal(secDataAfterSuccess.locked_until, null, 'Successful PIN verification must clear locked_until');
  } finally {
    server.close();
  }
});
