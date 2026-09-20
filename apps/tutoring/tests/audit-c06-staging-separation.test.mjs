import test from "node:test";
import assert from "node:assert/strict";
import { resolveApiBaseUrl } from "../../web/src/services/api.js";

// ============================================================================
// C-06: Staging & Production Separation Audit Test
// ============================================================================

test("C-06: resolveApiBaseUrl correctly routes local development to local API", () => {
  assert.equal(resolveApiBaseUrl("localhost"), "http://localhost:3000/api");
  assert.equal(resolveApiBaseUrl("127.0.0.1"), "http://localhost:3000/api");
  assert.equal(resolveApiBaseUrl("192.168.1.50"), "http://192.168.1.50:3000/api");
});

test("C-06: Production backend URL is strictly restricted to official production domains", () => {
  const PROD_URL = "https://tutoring-backend-production-c8dd.up.railway.app/api";

  assert.equal(resolveApiBaseUrl("centerly-eg.com"), PROD_URL);
  assert.equal(resolveApiBaseUrl("www.centerly-eg.com"), PROD_URL);
  assert.equal(resolveApiBaseUrl("centrly.app"), PROD_URL);
  assert.equal(resolveApiBaseUrl("www.centrly.app"), PROD_URL);
});

test("C-06: Staging, preview, and unknown domains NEVER fall back to production", () => {
  const STAGING_URL = "https://tutoring-backend-staging.up.railway.app/api";
  const PROD_URL = "https://tutoring-backend-production-c8dd.up.railway.app/api";

  const previewDomains = [
    "centerly-git-audit-2026-09-20.vercel.app",
    "staging.centerly-eg.com",
    "preview-feature-123.vercel.app",
    "dev.centerly.internal",
    "unknown-host.attacker.com",
    "my-staging-instance.fly.dev",
  ];

  for (const domain of previewDomains) {
    const resolved = resolveApiBaseUrl(domain);
    assert.equal(
      resolved,
      STAGING_URL,
      `Domain '${domain}' must route to staging and NEVER production`
    );
    assert.notEqual(
      resolved,
      PROD_URL,
      `Domain '${domain}' MUST NEVER resolve to production backend`
    );
  }
});

test("C-06: Custom environment variable override is respected when explicitly configured", () => {
  const customUrl = "https://custom-gateway.internal/api";
  assert.equal(resolveApiBaseUrl("any-domain.com", { VITE_API_BASE_URL: customUrl }), customUrl);
});
