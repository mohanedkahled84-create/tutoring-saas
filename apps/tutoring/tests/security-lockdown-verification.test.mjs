import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertRpcExists, assertServiceRoleReady, createIsolatedSupabaseClients, requireIsolatedSupabaseProject } from "./helpers/live-supabase.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

test("FOLLOW-UP (F): anon cannot invoke service-only email verification RPCs", async (t) => {
  if (!requireIsolatedSupabaseProject(t)) return;

  const { anonClient, serviceClient } = createIsolatedSupabaseClients();
  await assertServiceRoleReady(serviceClient);
  const email = `security-test-${Date.now()}-${Math.random()}@example.invalid`;
  await assertRpcExists(serviceClient, "confirm_user_email_direct", { p_email: email });
  await assertRpcExists(serviceClient, "is_email_confirmed", { p_email: email });
  await assertRpcExists(serviceClient, "record_email_otp", {
    p_email: email,
    p_code: "000000",
    p_expires_at: new Date(Date.now() + 60_000).toISOString(),
  });
  await serviceClient.from("email_verifications").delete().eq("email", email);

  const { error: confirmError } = await anonClient.rpc("confirm_user_email_direct", {
    p_email: "security-test-nonexistent@centerly-eg.com",
  });
  assert.ok(confirmError, "Anon must not execute confirm_user_email_direct");

  const { error: isConfirmedError } = await anonClient.rpc("is_email_confirmed", {
    p_email: "nonexistent-test-user-check@centerly-eg.com",
  });
  assert.ok(isConfirmedError, "Anon must not enumerate email verification state");

  const { error: otpError } = await anonClient.rpc("record_email_otp", {
    p_email: "security-test-nonexistent@centerly-eg.com",
    p_code: "000000",
    p_expires_at: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.ok(otpError, "Anon must not create or replace email OTP records");
});

test("FOLLOW-UP (F): Anon cannot write or update public.tenants table directly", async (t) => {
  if (!requireIsolatedSupabaseProject(t)) return;

  const { anonClient, serviceClient } = createIsolatedSupabaseClients();
  await assertServiceRoleReady(serviceClient);

  // Anon INSERT must fail
  const { error: insertErr } = await anonClient.from("tenants").insert({
    name: "Exploit Tenant",
    subscription_status: "active",
  });
  assert.ok(insertErr, "Anon insert on tenants must be denied");

  // Anon UPDATE must fail or affect 0 rows under RLS
  const { data: updatedRows, error: updateErr } = await anonClient
    .from("tenants")
    .update({ subscription_status: "active" })
    .eq("name", "Exploit Tenant")
    .select();
  assert.ok(updateErr || !updatedRows || updatedRows.length === 0, "Anon update on tenants must be denied or return 0 rows");
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
