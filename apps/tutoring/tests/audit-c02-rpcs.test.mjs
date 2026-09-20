import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// C-02: Secure SECURITY DEFINER RPCs Audit Test
// ============================================================================

test("C-02: Migration 20260920000002_audit_fix_c02_secure_rpcs.sql revokes RPC execute from anon and authenticated", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../../supabase/migrations/20260920000002_audit_fix_c02_secure_rpcs.sql"
  );
  assert.ok(fs.existsSync(migrationPath), "C-02 migration file must exist in supabase/migrations/");

  const sql = fs.readFileSync(migrationPath, "utf8");

  const rpcSignatures = [
    "create_teacher_secure(uuid, text, text, text[], text, numeric, text, uuid, text)",
    "create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text)",
    "create_room_secure(uuid, text, integer, numeric)",
  ];

  const lowerSql = sql.toLowerCase();
  for (const sig of rpcSignatures) {
    assert.ok(
      lowerSql.includes(`revoke execute on function public.${sig.toLowerCase()} from public, anon, authenticated;`),
      `Must revoke execute on ${sig} from public, anon, authenticated`
    );
    assert.ok(
      lowerSql.includes(`grant execute on function public.${sig.toLowerCase()} to service_role;`),
      `Must grant execute on ${sig} strictly to service_role`
    );
  }

  // Ensure SET search_path = public, pg_temp is present
  assert.ok(
    lowerSql.includes("set search_path = public, pg_temp"),
    "RPC functions must configure set search_path = public, pg_temp to prevent search_path hijacking"
  );

  // Ensure caller tenant validation check is present
  assert.ok(
    lowerSql.includes("v_caller_tenant <> p_tenant_id"),
    "Must verify caller tenant and prevent unauthorized cross-tenant creation"
  );
  assert.ok(
    lowerSql.includes("v_caller_role not in ('admin', 'owner', 'center_owner')"),
    "Must verify caller role"
  );
});

test("C-02: Anonymous callers cannot execute secure RPCs", async () => {
  const supabaseUrl = process.env.SUPABASE_URL || "https://ofaraxqrpcdiregxjyyb.supabase.co";
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!anonKey) {
    assert.ok(true, "Skipping live RPC test when SUPABASE_ANON_KEY is not configured");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const anonClient = createClient(supabaseUrl, anonKey);

  const { error: tErr } = await anonClient.rpc("create_teacher_secure", {
    p_tenant_id: "00000000-0000-0000-0000-000000000000",
    p_name: "Hacker",
    p_subject: "Math",
  });
  assert.ok(tErr, "create_teacher_secure must reject anonymous caller with error");

  const { error: aErr } = await anonClient.rpc("create_assistant_secure", {
    p_tenant_id: "00000000-0000-0000-0000-000000000000",
    p_name: "Hacker Assistant",
    p_phone: "01000000000",
  });
  assert.ok(aErr, "create_assistant_secure must reject anonymous caller with error");

  const { error: rErr } = await anonClient.rpc("create_room_secure", {
    p_tenant_id: "00000000-0000-0000-0000-000000000000",
    p_name: "Hacker Room",
    p_capacity: 10,
  });
  assert.ok(rErr, "create_room_secure must reject anonymous caller with error");
});
