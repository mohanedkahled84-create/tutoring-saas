import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// DEV-73: Center System Schema — Centers, Teachers, Assistants, Rooms, Enrollments
// ============================================================================

test("DEV-73: Migration 20260905000006_dev_center_system_schema.sql exists and is well-formed", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../../supabase/migrations/20260905000006_dev_center_system_schema.sql"
  );
  assert.ok(fs.existsSync(migrationPath), "Migration file must exist");

  const sql = fs.readFileSync(migrationPath, "utf8");

  // Verify account_type addition to tenants
  assert.ok(sql.includes("account_type"), "Must add account_type to tenants");
  assert.ok(sql.includes("'teacher', 'center'"), "Must constrain account_type to teacher or center");

  // Verify teachers table
  assert.ok(sql.includes("create table if not exists public.teachers"), "Must create teachers table");
  assert.ok(sql.includes("revenue_model"), "Teachers must have revenue_model");
  assert.ok(sql.includes("'percentage', 'fixed_per_student', 'fixed_total'"), "Must support 3 revenue split models");

  // Verify assistants table
  assert.ok(sql.includes("create table if not exists public.assistants"), "Must create assistants table");
  assert.ok(sql.includes("assistant_type"), "Assistants must have assistant_type");
  assert.ok(sql.includes("'assistant_to_center', 'assistant_to_teacher'"), "Must support center and teacher assistants");
  assert.ok(sql.includes("can_view_financials"), "Assistants must have can_view_financials flag");

  // Verify rooms table
  assert.ok(sql.includes("create table if not exists public.rooms"), "Must create rooms table");
  assert.ok(sql.includes("capacity"), "Rooms must have capacity");

  // Verify enrollments table (student-teacher-group join)
  assert.ok(sql.includes("create table if not exists public.enrollments"), "Must create enrollments table");
  assert.ok(sql.includes("uq_enrollments_student_group"), "Must have unique constraint for student-group enrollment");

  // Verify RLS policies
  assert.ok(sql.includes("alter table public.teachers enable row level security;"));
  assert.ok(sql.includes("alter table public.assistants enable row level security;"));
  assert.ok(sql.includes("alter table public.rooms enable row level security;"));
  assert.ok(sql.includes("alter table public.enrollments enable row level security;"));
});

test("DEV-73: Clean Architecture Rule 1 compliance check across features", () => {
  const featuresDir = path.resolve(__dirname, "../src/features");
  if (!fs.existsSync(featuresDir)) return;

  const files = fs.readdirSync(featuresDir, { recursive: true });
  for (const file of files) {
    if (typeof file === "string" && file.endsWith("service.ts")) {
      const fullPath = path.join(featuresDir, file);
      const code = fs.readFileSync(fullPath, "utf8");
      // Service files MUST NEVER import SupabaseClient or direct database drivers
      assert.ok(
        !code.includes("@supabase/supabase-js"),
        `Service file ${file} violates Rule 1: direct @supabase/supabase-js import detected!`
      );
      assert.ok(
        !code.includes("from \"pg\""),
        `Service file ${file} violates Rule 1: direct pg import detected!`
      );
    }
  }
});

// ============================================================================
// DEV-75: Center Signup + Account-Type Selection Tests
// ============================================================================

test("DEV-75: Center signup creates tenant with account_type='center' and user role 'center_owner'", async () => {
  const { FakeAuthRepository } = await import("../dist/features/auth/repository.js");
  const { AuthService } = await import("../dist/features/auth/service.js");

  const repo = new FakeAuthRepository();
  const service = new AuthService(repo);

  let alertPayload = null;
  const result = await service.signup(
    {
      email: "center.owner@al-awaael.com",
      password: "StrongPassword123!",
      full_name: "أ. سمير خليل",
      tenant_name: "سنتر الأوائل التعليمي",
      phone: "01012345678",
      account_type: "center",
      governorate: "القاهرة",
    },
    async (payload) => {
      alertPayload = payload;
    }
  );

  // Assert user role and tenant account_type
  assert.equal(result.user.role, "center_owner");
  assert.equal(result.tenant.account_type, "center");
  assert.equal(result.tenant.subscription_status, "trial");

  // Assert founder alert payload
  assert.ok(alertPayload);
  assert.equal(alertPayload.account_type, "center");
  assert.equal(alertPayload.tenant_name, "سنتر الأوائل التعليمي");
});

test("DEV-75: Solo teacher signup preserves tenant account_type='teacher' and role 'owner'", async () => {
  const { FakeAuthRepository } = await import("../dist/features/auth/repository.js");
  const { AuthService } = await import("../dist/features/auth/service.js");

  const repo = new FakeAuthRepository();
  const service = new AuthService(repo);

  const result = await service.signup({
    email: "solo.teacher@gmail.com",
    password: "StrongPassword123!",
    full_name: "أ. أحمد محمود",
    tenant_name: "مجموعة الأستاذ أحمد محمود",
    phone: "01123456789",
    account_type: "teacher",
  });

  assert.equal(result.user.role, "owner");
  assert.equal(result.tenant.account_type, "teacher");
  assert.equal(result.tenant.subscription_status, "trial");
});

test("DEV-75: formatNewSignupMessage formats distinct alerts for Center vs Solo Teacher", async () => {
  const { formatNewSignupMessage } = await import("../dist/features/admin-ops/founderAlert.js");

  const centerAlert = formatNewSignupMessage({
    teacher_name: "أ. سمير خليل",
    teacher_email: "center@example.com",
    tenant_name: "سنتر الأوائل",
    account_type: "center",
    trial_ends_at: "2026-09-19",
  });

  assert.ok(centerAlert.includes("🏢 *تسجيل سنتر تعليمي جديد في المنصة!*"));
  assert.ok(centerAlert.includes("🏢 *نوع الحساب:* سنتر تعليمي (Center)"));
  assert.ok(centerAlert.includes("🏢 *اسم السنتر:* سنتر الأوائل"));

  const teacherAlert = formatNewSignupMessage({
    teacher_name: "أ. محمود",
    teacher_email: "teacher@example.com",
    tenant_name: "مجموعة التفوق",
    account_type: "teacher",
    trial_ends_at: "2026-09-19",
  });

  assert.ok(teacherAlert.includes("🚀 *تسجيل معلم جديد في المنصة!*"));
  assert.ok(teacherAlert.includes("🏢 *نوع الحساب:* معلم فردي (Solo Teacher)"));
  assert.ok(teacherAlert.includes("👤 *المعلم:* أ. محمود"));
});

// ============================================================================
// DEV-76: Teacher/Assistant Onboarding (Invite Link + Direct Creation) Tests
// ============================================================================

test("DEV-76: generateInviteToken and verifyInviteToken manage signed expiring tokens", async () => {
  const { generateInviteToken, verifyInviteToken } = await import(
    "../dist/shared/utils/tokens.js"
  );

  // 1. Valid token
  const token = generateInviteToken("tenant-c1", "rec-100", "teacher", 7);
  assert.ok(token);
  const verified = verifyInviteToken(token);
  assert.ok(verified);
  assert.equal(verified.tenant_id, "tenant-c1");
  assert.equal(verified.record_id, "rec-100");
  assert.equal(verified.role, "teacher");

  // 2. Tampered token
  const tampered = token.slice(0, -4) + "AAAA";
  assert.equal(verifyInviteToken(tampered), null);

  // 3. Expired token
  const expiredToken = generateInviteToken("tenant-c1", "rec-100", "teacher", -1);
  assert.equal(verifyInviteToken(expiredToken), null);

  // 4. Malformed token
  assert.equal(verifyInviteToken("not-a-valid-token"), null);
});

test("DEV-76: CentersService.addTeacher with direct_creation provisions auth user and marks active", async () => {
  const { CentersService } = await import("../dist/features/centers/service.js");
  const { FakeCentersRepository } = await import("../dist/features/centers/repository.js");

  const repo = new FakeCentersRepository();
  const service = new CentersService(repo);

  const res = await service.addTeacher("tenant-c1", {
    name: "أ. طارق حسام",
    phone: "01011112222",
    email: "tarek.hossam@example.com",
    password: "TeacherPassword123!",
    subjects: ["فيزياء", "كيمياء"],
    revenue_model: "percentage",
    revenue_value: 80,
    onboarding_method: "direct_creation",
  });

  assert.equal(res.onboarding_method, "direct_creation");
  assert.equal(res.member.status, "active");
  assert.ok(res.member.user_id);
  assert.equal(res.member.name, "أ. طارق حسام");
  assert.equal(res.member.revenue_model, "percentage");
  assert.equal(res.member.revenue_value, 80);
  assert.equal(repo.users.length, 1);
  assert.equal(repo.users[0].role, "teacher");
});

test("DEV-76: CentersService.addTeacher with invite_link creates invited record with token", async () => {
  const { CentersService } = await import("../dist/features/centers/service.js");
  const { FakeCentersRepository } = await import("../dist/features/centers/repository.js");

  const repo = new FakeCentersRepository();
  const service = new CentersService(repo);

  const res = await service.addTeacher("tenant-c1", {
    name: "أ. رانيا عادل",
    phone: "01233334444",
    email: "rania@example.com",
    subjects: ["لغة إنجليزية"],
    onboarding_method: "invite_link",
  });

  assert.equal(res.onboarding_method, "invite_link");
  assert.equal(res.member.status, "invited");
  assert.equal(res.member.user_id, null);
  assert.ok(res.invite_token);
  assert.ok(res.invite_url.includes(res.invite_token));
  assert.equal(repo.users.length, 0); // No user provisioned yet until invite acceptance
});

test("DEV-76: CentersService.addAssistant supports both assistant_to_teacher and assistant_to_center", async () => {
  const { CentersService } = await import("../dist/features/centers/service.js");
  const { FakeCentersRepository } = await import("../dist/features/centers/repository.js");

  const repo = new FakeCentersRepository();
  const service = new CentersService(repo);

  // 1. Assistant to specific teacher (invite link)
  const asst1 = await service.addAssistant("tenant-c1", {
    name: "علي سعيد",
    phone: "01099998888",
    teacher_id: "teach-101",
    onboarding_method: "invite_link",
  });
  assert.equal(asst1.member.assistant_type, "assistant_to_teacher");
  assert.equal(asst1.member.teacher_id, "teach-101");
  assert.equal(asst1.member.status, "invited");

  // 2. Assistant to center (direct creation)
  const asst2 = await service.addAssistant("tenant-c1", {
    name: "مروة حسن",
    phone: "01188887777",
    email: "marwa.center@example.com",
    password: "AssistantPassword123!",
    assistant_type: "assistant_to_center",
    can_view_financials: false,
    onboarding_method: "direct_creation",
  });
  assert.equal(asst2.member.assistant_type, "assistant_to_center");
  assert.equal(asst2.member.status, "active");
  assert.ok(asst2.member.user_id);
});

test("DEV-76: CentersService.acceptInvite successfully activates invited teacher account", async () => {
  const { CentersService } = await import("../dist/features/centers/service.js");
  const { FakeCentersRepository } = await import("../dist/features/centers/repository.js");

  const repo = new FakeCentersRepository();
  const service = new CentersService(repo);

  // 1. Create invited teacher
  const inviteRes = await service.addTeacher("tenant-c1", {
    name: "أ. وائل شريف",
    phone: "01511112222",
    email: "wael@example.com",
    onboarding_method: "invite_link",
  });

  // 2. Accept invite
  const acceptRes = await service.acceptInvite({
    token: inviteRes.invite_token,
    password: "NewStrongPassword123!",
  });

  assert.equal(acceptRes.success, true);
  assert.equal(acceptRes.role, "teacher");
  assert.equal(acceptRes.record_id, inviteRes.member.id);

  // Verify updated status in repository
  const activated = await repo.getTeacherById("tenant-c1", inviteRes.member.id);
  assert.equal(activated.status, "active");
  assert.equal(activated.invite_token, null);
  assert.ok(activated.user_id);
});

test("DEV-76: CentersService.acceptInvite rejects invalid token or weak password", async () => {
  const { CentersService } = await import("../dist/features/centers/service.js");
  const { FakeCentersRepository } = await import("../dist/features/centers/repository.js");

  const repo = new FakeCentersRepository();
  const service = new CentersService(repo);

  await assert.rejects(
    async () => {
      await service.acceptInvite({
        token: "invalid-token",
        password: "ValidPassword123!",
      });
    },
    { message: "INVALID_OR_EXPIRED_TOKEN" }
  );

  await assert.rejects(
    async () => {
      await service.acceptInvite({
        token: "valid-looking-token",
        password: "short",
      });
    },
    { message: "WEAK_PASSWORD" }
  );
});

test("DEV-76: CentersService.resendTeacherInvite generates fresh token for pending invite", async () => {
  const { CentersService } = await import("../dist/features/centers/service.js");
  const { FakeCentersRepository } = await import("../dist/features/centers/repository.js");

  const repo = new FakeCentersRepository();
  const service = new CentersService(repo);

  const initial = await service.addTeacher("tenant-c1", {
    name: "أ. عصام جلال",
    phone: "01022223333",
    email: "essam@example.com",
    onboarding_method: "invite_link",
  });

  const resent = await service.resendTeacherInvite("tenant-c1", initial.member.id);
  assert.ok(resent.invite_token);
  assert.ok(resent.invite_url.includes(resent.invite_token));

  // Active teacher cannot have invite resent
  await repo.updateTeacher("tenant-c1", initial.member.id, { status: "active" });
  await assert.rejects(
    async () => {
      await service.resendTeacherInvite("tenant-c1", initial.member.id);
    },
    { message: "TEACHER_ALREADY_ACTIVE" }
  );
});

test("DEV-76: Center protected endpoints strictly return 401 when unauthenticated", async () => {
  const http = await import("node:http");
  const { app } = await import("../dist/app.js");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const url = `http://localhost:${port}`;

  try {
    const resTeachers = await fetch(`${url}/api/centers/teachers`);
    assert.equal(resTeachers.status, 401);

    const resAssistants = await fetch(`${url}/api/centers/assistants`);
    assert.equal(resAssistants.status, 401);

    // Public invite endpoint rejects invalid request with 400
    const resAccept = await fetch(`${url}/api/centers/invitations/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invalid-token", password: "Password123!" }),
    });
    assert.equal(resAccept.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});


