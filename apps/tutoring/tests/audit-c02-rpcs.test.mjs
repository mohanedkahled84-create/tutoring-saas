import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

test("C-02: Secure SECURITY DEFINER RPCs (Execution restricted, cross-tenant protected)", async (t) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    t.skip("Missing Supabase credentials for live test");
    return;
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const fakeTenantId = "00000000-0000-0000-0000-000000000001";

  // 1. Anon MUST NOT be able to execute create_teacher_secure
  const { error: teacherErr } = await anonClient.rpc("create_teacher_secure", {
    p_tenant_id: fakeTenantId,
    p_name: "Attacker Teacher",
    p_phone: "01099998888",
    p_subjects: ["math"],
    p_revenue_model: "percentage",
    p_revenue_value: 20
  });
  assert.ok(teacherErr, "Anon must be denied EXECUTE on create_teacher_secure");

  // 2. Anon MUST NOT be able to execute create_assistant_secure
  const { error: assistantErr } = await anonClient.rpc("create_assistant_secure", {
    p_tenant_id: fakeTenantId,
    p_name: "Attacker Assistant",
    p_phone: "01099998888"
  });
  assert.ok(assistantErr, "Anon must be denied EXECUTE on create_assistant_secure");

  // 3. Anon MUST NOT be able to execute create_room_secure
  const { error: roomErr } = await anonClient.rpc("create_room_secure", {
    p_tenant_id: fakeTenantId,
    p_name: "Attacker Room",
    p_capacity: 50
  });
  assert.ok(roomErr, "Anon must be denied EXECUTE on create_room_secure");
});
