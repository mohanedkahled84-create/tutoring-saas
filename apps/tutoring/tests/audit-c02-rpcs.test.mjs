import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertRpcExists, assertServiceRoleReady, createIsolatedSupabaseClients, requireIsolatedSupabaseProject } from "./helpers/live-supabase.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

test("C-02: Secure SECURITY DEFINER RPCs (Execution restricted, cross-tenant protected)", async (t) => {
  if (!requireIsolatedSupabaseProject(t)) return;

  const { anonClient, serviceClient } = createIsolatedSupabaseClients();
  await assertServiceRoleReady(serviceClient);
  const fakeTenantId = "00000000-0000-0000-0000-000000000001";
  const calls = [
    ["create_teacher_secure", {
      p_tenant_id: fakeTenantId, p_name: "Attacker Teacher", p_phone: "01099998888",
      p_subjects: ["math"], p_revenue_model: "percentage", p_revenue_value: 20,
      p_status: "active", p_user_id: null, p_invite_token: null,
    }],
    ["create_assistant_secure", {
      p_tenant_id: fakeTenantId, p_name: "Attacker Assistant", p_phone: "01099998888",
      p_assistant_type: "individual", p_teacher_id: null, p_can_view_financials: false,
      p_status: "active", p_salary: 0, p_user_id: null, p_invite_token: null,
      p_role_type: "assistant", p_group_id: null, p_salary_model: "fixed",
    }],
    ["create_room_secure", { p_tenant_id: fakeTenantId, p_name: "Attacker Room", p_capacity: 50, p_hourly_rate: 0 }],
    ["get_user_profile", { p_user_id: fakeTenantId }],
    ["get_tenant_whatsapp_connection", { p_tenant_id: fakeTenantId }],
    ["get_email_by_phone", { p_phone: "01000000000" }],
    ["get_emails_by_phone", { p_phone: "01000000000" }],
    ["list_assistants_secure", { p_tenant_id: fakeTenantId }],
    ["get_student_for_portal", { p_identifier: "01000000000" }],
    ["get_student_for_portal", { p_identifier: "01000000000", p_password: "wrong" }],
    ["get_parent_portal_payload", { p_token: "invalid", p_student_id: fakeTenantId, p_tenant_id: fakeTenantId }],
    ["resolve_portal_short_code", { p_code: "s000000" }],
    ["submit_homework_portal", { p_portal_token: "invalid", p_material_id: fakeTenantId, p_file_url: "https://example.invalid/file.pdf", p_file_name: "test.pdf", p_student_id: fakeTenantId }],
    ["verify_homework_target", { p_material_id: fakeTenantId, p_tenant_id: fakeTenantId }],
  ];

  for (const [name, args] of calls) {
    await assertRpcExists(serviceClient, name, args);
    const { error } = await anonClient.rpc(name, args);
    assert.ok(error, `Anon must not execute sensitive RPC ${name}`);
  }
});
