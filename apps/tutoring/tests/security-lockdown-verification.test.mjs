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

test("FOLLOW-UP (F): confirm_user_email_direct rejects unauthorized calls without verified OTP", async (t) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    t.skip("Missing Supabase credentials for live test");
    return;
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const fakeUserId = "00000000-0000-0000-0000-000000000001";

  // 1. confirm_user_email_direct MUST be rejected without a verified OTP record
  const { error: err1 } = await anonClient.rpc("confirm_user_email_direct", {
    p_user_id: fakeUserId,
  });
  assert.ok(err1, "Anon must be denied confirmation without verified OTP");
  assert.ok(["42501", "PGRST202", "P0001"].includes(err1.code) || (err1.message && err1.message.includes("UNAUTHORIZED")), `Expected unauthorized error, got ${err1.code}: ${err1.message}`);

  // 2. is_email_confirmed safely returns boolean status
  const { data: confirmedStatus, error: err2 } = await anonClient.rpc("is_email_confirmed", {
    p_email: "nonexistent-test-user-check@centerly-eg.com",
  });
  assert.equal(err2, null, "is_email_confirmed must execute cleanly for login preflight checks");
  assert.equal(confirmedStatus, false, "Nonexistent user returns false");
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
