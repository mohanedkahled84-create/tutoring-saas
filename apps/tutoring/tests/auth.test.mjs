import test from "node:test";
import assert from "node:assert/strict";
import {
  AuthService,
  FakeAuthRepository,
  resetLoginAttempts,
} from "../dist/features/auth/index.js";

test("DEV-68: AuthService - Password policy enforces security requirements", () => {
  const repo = new FakeAuthRepository();
  const service = new AuthService(repo);

  assert.equal(service.validatePassword("123").valid, false);
  assert.equal(service.validatePassword("weakpassword").valid, false);
  assert.equal(service.validatePassword("StrongPass#123").valid, true);
});

test("DEV-68: AuthService - Signup establishes 14-day trial and calls founder alert callback", async () => {
  const repo = new FakeAuthRepository();
  const service = new AuthService(repo);

  let alertCalled = false;
  let alertRecipient = "";

  const result = await service.signup(
    {
      email: "teacher@test.com",
      password: "StrongPass#123",
      full_name: "الأستاذ خالد",
      tenant_name: "أكاديمية النجاح",
      phone: "01011112222",
    },
    async (payload) => {
      alertCalled = true;
      alertRecipient = payload.teacher_email;
    }
  );

  assert.equal(result.user.email, "teacher@test.com");
  assert.equal(result.tenant.subscription_status, "trial");
  assert.ok(result.tenant.trial_ends_at);
  assert.equal(alertCalled, true);
  assert.equal(alertRecipient, "teacher@test.com");
});

test("DEV-68: AuthService - Brute force locks out after 5 consecutive failures", async () => {
  const repo = new FakeAuthRepository();
  const service = new AuthService(repo);
  const email = "lockout-test@domain.com";
  resetLoginAttempts(email);

  repo.users.push({
    id: "user-1",
    email,
    password: "CorrectPassword#1",
    tenant_id: "tenant-1",
    role: "owner",
  });

  // 5 failed attempts
  for (let i = 0; i < 5; i++) {
    await assert.rejects(
      async () => {
        await service.login({ email, password: "WrongPassword" });
      },
      { message: "INVALID_CREDENTIALS" }
    );
  }

  // 6th attempt is locked out
  await assert.rejects(
    async () => {
      await service.login({ email, password: "CorrectPassword#1" });
    },
    (err) => err.code === "ACCOUNT_LOCKED"
  );

  resetLoginAttempts(email);
});
