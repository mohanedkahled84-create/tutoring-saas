import test from "node:test";
import assert from "node:assert/strict";
import { requireIsolatedSupabaseProject } from "./helpers/live-supabase.mjs";

const managedKeys = [
  "SUPABASE_TEST_URL",
  "SUPABASE_TEST_ANON_KEY",
  "SUPABASE_TEST_SERVICE_ROLE_KEY",
  "SUPABASE_TEST_PROJECT_REF",
  "SUPABASE_TEST_ENV",
  "SUPABASE_PRODUCTION_PROJECT_REF",
  "REQUIRE_LIVE_SUPABASE_TESTS",
];

function withEnvironment(values, callback) {
  const original = new Map(managedKeys.map((key) => [key, process.env[key]]));
  for (const key of managedKeys) delete process.env[key];
  Object.assign(process.env, values);
  try {
    return callback();
  } finally {
    for (const key of managedKeys) {
      if (original.get(key) === undefined) delete process.env[key];
      else process.env[key] = original.get(key);
    }
  }
}

test("Live Supabase tests fail closed in CI when isolated credentials are absent", () => {
  withEnvironment({ REQUIRE_LIVE_SUPABASE_TESTS: "true" }, () => {
    assert.throws(
      () => requireIsolatedSupabaseProject({ skip() { throw new Error("must not skip"); } }),
      /isolated Supabase test project/
    );
  });
});

test("Live Supabase tests reject a URL that points at the production project", () => {
  withEnvironment({
    SUPABASE_TEST_URL: "https://ofaraxqrpcdiregxjyyb.supabase.co",
    SUPABASE_TEST_ANON_KEY: "test-key",
    SUPABASE_TEST_SERVICE_ROLE_KEY: "service-test-key",
    SUPABASE_TEST_PROJECT_REF: "ofaraxqrpcdiregxjyyb",
    SUPABASE_TEST_ENV: "isolated",
    SUPABASE_PRODUCTION_PROJECT_REF: "ofaraxqrpcdiregxjyyb",
  }, () => {
    let skipReason = "";
    const result = requireIsolatedSupabaseProject({ skip(reason) { skipReason = reason; } });
    assert.equal(result, false);
    assert.match(skipReason, /isolated Supabase test project/);
  });
});

test("Live Supabase tests accept only a matching isolated test project URL and ref", () => {
  withEnvironment({
    SUPABASE_TEST_URL: "https://abcdefghijklmnopqrst.supabase.co",
    SUPABASE_TEST_ANON_KEY: "test-key",
    SUPABASE_TEST_SERVICE_ROLE_KEY: "service-test-key",
    SUPABASE_TEST_PROJECT_REF: "abcdefghijklmnopqrst",
    SUPABASE_TEST_ENV: "isolated",
    SUPABASE_PRODUCTION_PROJECT_REF: "ofaraxqrpcdiregxjyyb",
  }, () => {
    assert.equal(requireIsolatedSupabaseProject({ skip() { throw new Error("must not skip"); } }), true);
  });
});
