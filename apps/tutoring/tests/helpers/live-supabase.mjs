import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

export function requireIsolatedSupabaseProject(t) {
  const url = process.env.SUPABASE_TEST_URL;
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  const projectRef = process.env.SUPABASE_TEST_PROJECT_REF;
  const productionRef = process.env.SUPABASE_PRODUCTION_PROJECT_REF || "ofaraxqrpcdiregxjyyb";
  let isolated = false;

  if (url && anonKey && serviceRoleKey && projectRef && process.env.SUPABASE_TEST_ENV === "isolated") {
    try {
      isolated = /^[a-z0-9]{20}$/.test(projectRef)
        && projectRef !== productionRef
        && new URL(url).hostname === `${projectRef}.supabase.co`;
    } catch {
      isolated = false;
    }
  }

  if (!isolated) {
    const message = "Live security checks require an isolated Supabase test project and matching SUPABASE_TEST_PROJECT_REF";
    if (process.env.REQUIRE_LIVE_SUPABASE_TESTS === "true") throw new Error(message);
    t.skip(message);
    return false;
  }

  return true;
}

export function createIsolatedSupabaseClients() {
  return {
    anonClient: createClient(process.env.SUPABASE_TEST_URL, process.env.SUPABASE_TEST_ANON_KEY),
    serviceClient: createClient(process.env.SUPABASE_TEST_URL, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY),
  };
}

export async function assertServiceRoleReady(serviceClient) {
  const { error } = await serviceClient.from("tenants").select("id").limit(0);
  assert.equal(error, null, `Test service-role key must access the isolated project: ${error?.message ?? "unknown error"}`);
}

// An anon RPC error alone is not proof of a permission check: PostgREST also
// reports a missing function or mismatched signature as an error. Verify that
// the service-role client can resolve the RPC before asserting anon is blocked.
export async function assertRpcExists(serviceClient, name, args) {
  const { error } = await serviceClient.rpc(name, args);
  assert.notEqual(
    error?.code,
    "PGRST202",
    `Expected RPC ${name} with this argument signature to exist; PostgREST could not resolve it`
  );
  assert.doesNotMatch(error?.message ?? "", /could not find the function|schema cache/i,
    `Expected RPC ${name} with this argument signature to exist`);
}
