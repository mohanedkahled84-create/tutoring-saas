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

