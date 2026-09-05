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
