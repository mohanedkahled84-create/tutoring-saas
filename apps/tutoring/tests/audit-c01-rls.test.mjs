import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// C-01: RLS Tenant Isolation Audit Test
// ============================================================================

test("C-01: Migration 20260920000001_audit_fix_c01_rls_tenant_isolation.sql exists and enforces strict tenant isolation", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../../supabase/migrations/20260920000001_audit_fix_c01_rls_tenant_isolation.sql"
  );
  assert.ok(fs.existsSync(migrationPath), "C-01 migration file must exist in supabase/migrations/");

  const sql = fs.readFileSync(migrationPath, "utf8");

  // Verify all 7 critical tables have permissive policies dropped and replaced
  const targetTables = [
    "study_materials",
    "message_templates",
    "quizzes",
    "teachers",
    "assistants",
    "rooms",
    "homework_submissions",
  ];

  for (const table of targetTables) {
    assert.ok(
      sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`),
      `RLS must be enabled on public.${table}`
    );
    assert.ok(
      sql.includes(`REVOKE ALL ON public.${table} FROM anon, public;`),
      `Must revoke access to public.${table} from anon and public`
    );
    assert.ok(
      sql.includes(`"${table}_service_role"`),
      `Must restrict service_role policy for ${table}`
    );
  }

  for (const table of ["study_materials", "message_templates", "quizzes", "homework_submissions"]) {
    assert.ok(
      sql.includes(`"${table}_tenant_select"`),
      `Must create scoped tenant select policy for ${table}`
    );
  }

  // Ensure tenant scoping uses get_current_user_tenant_id()
  assert.ok(
    sql.includes("tenant_id = get_current_user_tenant_id()"),
    "Tenant policy must check tenant_id = get_current_user_tenant_id()"
  );

  // Ensure global bypass is strictly limited to service_role, NEVER public or anon
  assert.ok(
    sql.includes("TO service_role"),
    "Bypass policies must strictly be assigned TO service_role"
  );

  // Ensure homework-submissions bucket is set to private
  assert.ok(
    sql.includes("UPDATE storage.buckets SET public = false WHERE id = 'homework-submissions';"),
    "homework-submissions bucket must be private"
  );
});

test("C-01: Anonymous access to tenant-scoped tables returns zero unauthorized rows", async () => {
  const supabaseUrl = process.env.SUPABASE_URL || "https://ofaraxqrpcdiregxjyyb.supabase.co";
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!anonKey) {
    // In local unit test environments without remote credentials, verify migration static assertions pass
    assert.ok(true, "Skipping live query test when SUPABASE_ANON_KEY is not configured");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const anonClient = createClient(supabaseUrl, anonKey);

  const tables = ["study_materials", "message_templates", "quizzes", "teachers", "assistants", "rooms", "homework_submissions"];

  for (const table of tables) {
    const { data, error } = await anonClient.from(table).select("*").limit(5);
    // Either error (401/403/RLS) or 0 rows returned
    assert.ok(
      error || (Array.isArray(data) && data.length === 0),
      `Anonymous query to ${table} must NOT return sensitive tenant rows`
    );
  }
});
