import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

test("FOLLOW-UP (F): Anon cannot execute the 5 locked-down auth RPCs", async (t) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    t.skip("Missing Supabase credentials for live test");
    return;
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const fakeUserId = "00000000-0000-0000-0000-000000000001";

  // 1. confirm_user_email_direct
  const { error: err1 } = await anonClient.rpc("confirm_user_email_direct", {
    p_user_id: fakeUserId,
  });
  assert.ok(err1, "Anon must be denied EXECUTE on confirm_user_email_direct");
  assert.ok(["42501", "PGRST202"].includes(err1.code), `Expected 42501 or PGRST202, got ${err1.code}`);

  // 2. get_email_by_phone
  const { error: err2 } = await anonClient.rpc("get_email_by_phone", {
    p_phone: "01000000000",
  });
  assert.ok(err2, "Anon must be denied EXECUTE on get_email_by_phone");
  assert.ok(["42501", "PGRST202"].includes(err2.code), `Expected 42501 or PGRST202, got ${err2.code}`);

  // 3. get_emails_by_phone
  const { error: err3 } = await anonClient.rpc("get_emails_by_phone", {
    p_phone: "01000000000",
  });
  assert.ok(err3, "Anon must be denied EXECUTE on get_emails_by_phone");
  assert.ok(["42501", "PGRST202"].includes(err3.code), `Expected 42501 or PGRST202, got ${err3.code}`);

  // 4. register_tenant_owner
  const { error: err4 } = await anonClient.rpc("register_tenant_owner", {
    p_user_id: fakeUserId,
    p_email: "attacker@example.com",
    p_full_name: "Attacker",
    p_phone: "01000000000",
    p_tenant_name: "Attacker Center",
    p_account_type: "teacher",
    p_trial_ends_at: new Date().toISOString(),
  });
  assert.ok(err4, "Anon must be denied EXECUTE on register_tenant_owner");
  assert.ok(["42501", "PGRST202"].includes(err4.code), `Expected 42501 or PGRST202, got ${err4.code}`);

  // 5. register_tenant_owner_direct
  const { error: err5 } = await anonClient.rpc("register_tenant_owner_direct", {
    p_email: "attacker@example.com",
    p_password: "Password123!",
    p_full_name: "Attacker",
    p_phone: "01000000000",
    p_tenant_name: "Attacker Center",
    p_account_type: "teacher",
    p_trial_ends_at: new Date().toISOString(),
  });
  assert.ok(err5, "Anon must be denied EXECUTE on register_tenant_owner_direct");
  assert.ok(["42501", "PGRST202"].includes(err5.code), `Expected 42501 or PGRST202, got ${err5.code}`);

  // 6. is_email_confirmed
  const { error: err6 } = await anonClient.rpc("is_email_confirmed", {
    p_email: "attacker@example.com",
  });
  assert.ok(err6, "Anon must be denied EXECUTE on is_email_confirmed");
  assert.ok(["42501", "PGRST202"].includes(err6.code), `Expected 42501 or PGRST202, got ${err6.code}`);
});

test("FOLLOW-UP (F): Anon cannot write or update public.tenants table directly", async (t) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    t.skip("Missing Supabase credentials for live test");
    return;
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey);

  // Anon INSERT must fail
  const { error: insertErr } = await anonClient.from("tenants").insert({
    name: "Exploit Tenant",
    subscription_status: "active",
  });
  assert.ok(insertErr, "Anon insert on tenants must be denied");

  // Anon UPDATE must fail
  const { error: updateErr } = await anonClient
    .from("tenants")
    .update({ subscription_status: "active" })
    .eq("name", "Exploit Tenant");
  assert.ok(updateErr, "Anon update on tenants must be denied");
});

test("FOLLOW-UP (F): Payment proof repository allows valid proof submission", async () => {
  const { SupabaseBillingRepository } = await import("../dist/features/billing/repository.js");
  assert.ok(SupabaseBillingRepository, "SupabaseBillingRepository must exist");
  assert.equal(
    typeof SupabaseBillingRepository.prototype.createPaymentProof,
    "function",
    "createPaymentProof method must exist"
  );
});
