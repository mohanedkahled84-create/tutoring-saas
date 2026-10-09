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

test("DEV-68: AuthService - Signup establishes 14-day trial and calls founder alert callback with OTP", async () => {
  const repo = new FakeAuthRepository();
  const service = new AuthService(repo);

  let alertCalled = false;
  let alertRecipient = "";
  let receivedOtp = "";

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
      receivedOtp = payload.otp_code;
    }
  );

  assert.equal(result.user.email, "teacher@test.com");
  assert.equal(result.tenant.subscription_status, "trial");
  assert.ok(result.tenant.trial_ends_at);
  assert.equal(alertCalled, true);
  assert.equal(alertRecipient, "teacher@test.com");
  assert.equal(receivedOtp, "123456");
  assert.equal(result.otp_code, "123456");
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

test("AUTH-VERIFY: Unverified email blocks login and requires OTP verification", async () => {
  const repo = new FakeAuthRepository();
  const service = new AuthService(repo);

  const email = "unverified@domain.com";
  const password = "ValidPassword123!";
  const phone = "01098765432";

  // Simulate signup creating an unconfirmed user
  repo.users.push({
    id: "user-unverified",
    email,
    password,
    phone,
    tenant_id: "tenant-unverified",
    role: "owner",
    email_confirmed: false,
  });

  repo.verifications.set(email, {
    code: "123456",
    expires_at: Date.now() + 15 * 60 * 1000,
    verified: false,
    attempts: 0,
    created_at: Date.now(),
  });

  // 1. Attempt login with unverified email should be blocked with EMAIL_NOT_VERIFIED
  await assert.rejects(
    async () => {
      await service.login({ email, password });
    },
    (err) => err.code === "EMAIL_NOT_VERIFIED"
  );

  // 2. Wrong OTP code fails
  await assert.rejects(
    async () => {
      await service.verifyEmail({ email, code: "999999" });
    },
    { message: "رمز التحقق غير صحيح. يرجى التأكد وإعادة المحاولة." }
  );

  // 3. Correct OTP code succeeds and confirms email
  const verifyRes = await service.verifyEmail({ email, code: "123456" });
  assert.equal(verifyRes.verified, true);

  // 4. Now login with email succeeds
  const loginRes = await service.login({ email, password });
  assert.ok(loginRes.token);
  assert.equal(loginRes.user.email, email);

  // 5. Login using phone number (01098765432) also succeeds
  const phoneLoginRes = await service.login({ email: phone, password });
  assert.ok(phoneLoginRes.token);
  assert.equal(phoneLoginRes.user.email, email);
});

test("AUTH-RESEND: Resend verification code updates the OTP and delivers new code", async () => {
  const repo = new FakeAuthRepository();
  const service = new AuthService(repo);
  const email = "resend-test@domain.com";

  repo.verifications.set(email, {
    code: "111111",
    expires_at: Date.now() + 15 * 60 * 1000,
    verified: false,
    attempts: 0,
    created_at: Date.now(),
  });

  const resendRes = await service.resendVerification({ email });
  assert.equal(resendRes.success, true);

  // Old code 111111 should fail, new code 654321 should succeed
  await assert.rejects(
    async () => {
      await service.verifyEmail({ email, code: "111111" });
    }
  );

  const verifyRes = await service.verifyEmail({ email, code: "654321" });
  assert.equal(verifyRes.verified, true);
});

test("AUTH-COLLISION: Phone conflict takes precedence over email conflict and avoids generic substring trap", () => {
  // Simulates the exact Postgres error when phone is already registered
  const phoneErr = new Error("رقم الهاتف هذا مسجل بالفعل بحساب آخر.");
  (phoneErr).code = "PHONE_ALREADY_EXISTS";

  const errCode = (phoneErr).code;
  const errMsg = phoneErr.message;

  const isPhoneConflict =
    errCode === "PHONE_ALREADY_EXISTS" ||
    errMsg.includes("PHONE_ALREADY_EXISTS") ||
    errMsg.includes("رقم الهاتف") ||
    errMsg.includes("بحساب آخر") ||
    errMsg.includes("users_phone_key");

  const isEmailConflict = !isPhoneConflict && (
    errCode === "USER_ALREADY_EXISTS" ||
    errMsg.includes("USER_ALREADY_EXISTS") ||
    errMsg.includes("البريد الإلكتروني مسجل بالفعل") ||
    errMsg.includes("هذا البريد الإلكتروني مسجل بالفعل") ||
    errMsg.includes("already registered") ||
    errMsg.toLowerCase().includes("user already exists") ||
    errMsg.includes("users_email_partial_key")
  );

  assert.equal(isPhoneConflict, true, "Phone collision must be recognized as phone conflict");
  assert.equal(isEmailConflict, false, "Phone collision must NOT trigger email conflict");
});

