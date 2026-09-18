import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { FakeTenantsRepository } from '../dist/features/auth/repository.js';
import { settingsRouter } from '../dist/features/auth/settingsRoutes.js';

test('SEC-PIN: Account-Level Security PIN synchronization across mobile and desktop devices', async () => {
  const fakeTenantsRepo = new FakeTenantsRepository();
  const app = express();
  app.use(express.json());

  // Current session user context
  let currentUser = {
    id: 'user-teacher-mohaned-123',
    email: 'mohanedkahled84@gmail.com',
    tenant_id: 'tenant-org-7b8b',
    role: 'owner',
    financial_pin: null,
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
    // 1. Brand new device (Device A: Laptop) before PIN exists
    const res1 = await fetch(`${baseUrl}/api/settings/security-pin`);
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.has_pin, false, 'Before setting PIN, has_pin must be false');

    // 2. Teacher sets PIN on Laptop (Device A)
    const res2 = await fetch(`${baseUrl}/api/settings/security-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' }),
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.success, true);

    // Verify PIN is saved in repository directly on the user account
    const savedUserPin = await fakeTenantsRepo.getUserPin('user-teacher-mohaned-123');
    assert.equal(savedUserPin, '1234', 'User account in repository must store PIN 1234');

    // 3. Opening account on Mobile Phone (Device B) - Completely fresh device without localStorage
    currentUser.financial_pin = null;
    currentUser.has_security_pin = false;

    const res3 = await fetch(`${baseUrl}/api/settings/security-pin`);
    assert.equal(res3.status, 200);
    const body3 = await res3.json();
    assert.equal(body3.has_pin, true, 'Mobile phone must detect that account has PIN');

    // 4. Entering correct PIN on Mobile Phone (Device B)
    const res4 = await fetch(`${baseUrl}/api/settings/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' }),
    });
    assert.equal(res4.status, 200);
    const body4 = await res4.json();
    assert.equal(body4.valid, true, 'Correct PIN must unlock sensitive views on mobile');

    // 4b. Entering PIN on Mobile Phone using Arabic keyboard (١٢٣٤)
    const res4b = await fetch(`${baseUrl}/api/settings/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '١٢٣٤' }),
    });
    assert.equal(res4b.status, 200);
    const body4b = await res4b.json();
    assert.equal(body4b.valid, true, 'Arabic numerals (١٢٣٤) must automatically normalize and unlock on mobile');

    // 4c. Entering PIN on Mobile Phone using Persian keyboard (۱۲۳۴)
    const res4c = await fetch(`${baseUrl}/api/settings/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '۱۲۳۴' }),
    });
    assert.equal(res4c.status, 200);
    const body4c = await res4c.json();
    assert.equal(body4c.valid, true, 'Persian numerals (۱۲۳۴) must automatically normalize and unlock on mobile');

    // 5. Entering incorrect PIN on Mobile Phone
    const res5 = await fetch(`${baseUrl}/api/settings/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '9999' }),
    });
    assert.equal(res5.status, 200);
    const body5 = await res5.json();
    assert.equal(body5.valid, false, 'Incorrect PIN must be rejected');

    // 6. Updating PIN from Mobile Phone (Device B) with valid old PIN
    const res6 = await fetch(`${baseUrl}/api/settings/security-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '5678', old_pin: '1234' }),
    });
    assert.equal(res6.status, 200);
    const body6 = await res6.json();
    assert.equal(body6.success, true);

    const updatedUserPin = await fakeTenantsRepo.getUserPin('user-teacher-mohaned-123');
    assert.equal(updatedUserPin, '5678', 'User account must have updated PIN 5678');

    // 7. Verifying Laptop (Device A) now unlocks with updated PIN 5678
    const res7 = await fetch(`${baseUrl}/api/settings/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '5678' }),
    });
    assert.equal(res7.status, 200);
    const body7 = await res7.json();
    assert.equal(body7.valid, true, 'Laptop must recognize updated account PIN 5678');
  } finally {
    server.close();
  }
});
