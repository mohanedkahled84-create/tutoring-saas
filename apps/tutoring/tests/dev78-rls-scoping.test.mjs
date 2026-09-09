import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// DEV-78: Assistant/Teacher Permission Scoping Migration & Policy Verification
// ============================================================================

test("DEV-78: Migration 20260909000002_dev78_center_rls_permission_scoping.sql exists and enforces scoped policies", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../../supabase/migrations/20260909000002_dev78_center_rls_permission_scoping.sql"
  );
  assert.ok(fs.existsSync(migrationPath), "DEV-78 migration file must exist");

  const sql = fs.readFileSync(migrationPath, "utf8");

  // 1. Helper functions
  assert.ok(
    sql.includes("create or replace function public.get_current_user_teacher_id()"),
    "Must create get_current_user_teacher_id function"
  );
  assert.ok(
    sql.includes("create or replace function public.can_current_user_view_financials()"),
    "Must create can_current_user_view_financials function"
  );
  assert.ok(
    sql.includes("revoke execute on function public.get_current_user_teacher_id() from anon, public;"),
    "Must revoke get_current_user_teacher_id from anon"
  );
  assert.ok(
    sql.includes("revoke execute on function public.can_current_user_view_financials() from anon, public;"),
    "Must revoke can_current_user_view_financials from anon"
  );

  // 2. Scoped policies on groups
  assert.ok(sql.includes('create policy "Tenant scoped groups select" on public.groups'), "Must scope groups select");
  assert.ok(sql.includes("teacher_id = public.get_current_user_teacher_id()"), "Groups must scope to current teacher");

  // 3. Scoped policies on sessions
  assert.ok(sql.includes('create policy "Tenant scoped sessions select" on public.sessions'), "Must scope sessions select");

  // 4. Scoped policies on attendance
  assert.ok(sql.includes('create policy "Tenant scoped attendance select" on public.attendance'), "Must scope attendance select");

  // 5. Scoped policies on enrollments
  assert.ok(sql.includes('create policy "Tenant scoped enrollments select" on public.enrollments'), "Must scope enrollments select");

  // 6. Scoped policies on students
  assert.ok(sql.includes('create policy "Tenant scoped students select" on public.students'), "Must scope students select");

  // 7. Scoped policies on teacher payouts (financials)
  assert.ok(sql.includes('create policy "Tenant scoped teacher payouts select" on public.teacher_payouts'), "Must scope teacher payouts select");
  assert.ok(sql.includes("public.can_current_user_view_financials()"), "Payouts must require can_current_user_view_financials()");
});

test("DEV-78: SQL Leak Test Suite tests/rls-center-scoping.test.sql exists and covers all required leak vectors", () => {
  const sqlTestPath = path.resolve(__dirname, "../../../tests/rls-center-scoping.test.sql");
  assert.ok(fs.existsSync(sqlTestPath), "tests/rls-center-scoping.test.sql must exist");

  const sql = fs.readFileSync(sqlTestPath, "utf8");

  // Verify all 6 mandatory test scenarios are present
  assert.ok(sql.includes("TEST CASE 1: Teacher 1 can see own data, CANNOT see Teacher 2's data"), "Must test teacher isolation");
  assert.ok(sql.includes("TEST CASE 2: Assistant-to-Teacher 1 cannot see Teacher 2's data"), "Must test assistant-to-teacher scoping");
  assert.ok(sql.includes("TEST CASE 3: Assistant-to-Teacher 1 CANNOT see Financial Data"), "Must test assistant-to-teacher financial block");
  assert.ok(sql.includes("TEST CASE 4: Assistant-to-Center (Default) sees operational data, NOT financials"), "Must test assistant-to-center financial block");
  assert.ok(sql.includes("TEST CASE 5: Assistant-to-Center with can_view_financials = true CAN see financials"), "Must test assistant-to-center financial grant");
  assert.ok(sql.includes("TEST CASE 6: Center Owner sees everything"), "Must test center owner full visibility");
});

test("DEV-78: Application-layer role scoping aligns with RLS permission model", async () => {
  const { CentersService } = await import("../dist/features/centers/service.js");
  const { FakeCentersRepository } = await import("../dist/features/centers/repository.js");

  const repo = new FakeCentersRepository();
  const service = new CentersService(repo);

  // Setup center, teachers, and assistant
  const tenantId = "tenant-center-sec";
  const teacher1 = await service.addTeacher(tenantId, {
    name: "أ. أحمد شريف",
    phone: "01011111111",
    subjects: ["كيمياء"],
    revenue_model: "percentage",
    revenue_value: 80,
  });
  const teacher2 = await service.addTeacher(tenantId, {
    name: "أ. محمود شاكر",
    phone: "01022222222",
    subjects: ["أحياء"],
    revenue_model: "percentage",
    revenue_value: 75,
  });

  // Assistant to teacher 1
  const asstTeacher1 = await service.addAssistant(tenantId, {
    name: "مساعد أحمد",
    phone: "01033333333",
    assistant_type: "assistant_to_teacher",
    teacher_id: teacher1.member.id,
    can_view_financials: false,
  });

  // General center assistant without financial view
  const asstCenter = await service.addAssistant(tenantId, {
    name: "مساعد السنتر",
    phone: "01044444444",
    assistant_type: "assistant_to_center",
    can_view_financials: false,
  });

  // Financial center assistant
  const asstCenterFin = await service.addAssistant(tenantId, {
    name: "محاسب السنتر",
    phone: "01055555555",
    assistant_type: "assistant_to_center",
    can_view_financials: true,
  });

  assert.equal(asstTeacher1.member.teacher_id, teacher1.member.id);
  assert.equal(asstTeacher1.member.can_view_financials, false);
  assert.equal(asstCenter.member.can_view_financials, false);
  assert.equal(asstCenterFin.member.can_view_financials, true);

  // Verify financial report can be retrieved by center owner and teachers
  const report1 = await service.getTeacherFinancialReport(tenantId, teacher1.member.id, "2026-09");
  assert.equal(report1.teacher.id, teacher1.member.id);
  assert.equal(report1.payout.status, "unpaid");

  // Toggle payout status
  const updatedPayout = await service.setTeacherPayoutStatus(tenantId, {
    teacher_id: teacher1.member.id,
    period: "2026-09",
    status: "paid",
    paid_by: "u-owner",
    notes: "Settled via cash",
  });
  assert.equal(updatedPayout.status, "paid");
});
