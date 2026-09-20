import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { app } from "../dist/app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// C-07: CORS Restriction & Security Headers Audit Test
// ============================================================================

test("C-07: vercel.json contains required security headers", () => {
  const vercelJsonPath = path.resolve(__dirname, "../../../apps/web/vercel.json");
  assert.ok(fs.existsSync(vercelJsonPath), "apps/web/vercel.json must exist");

  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));
  assert.ok(Array.isArray(vercelConfig.headers), "vercel.json must define headers array");

  const globalHeaderRule = vercelConfig.headers.find(
    (h) => h.source === "/(.*)" || h.source === "(.*)"
  );
  assert.ok(globalHeaderRule, "Must have global header rule matching all routes");

  const headerMap = {};
  for (const h of globalHeaderRule.headers) {
    headerMap[h.key.toLowerCase()] = h.value;
  }

  // 1. X-Frame-Options: DENY
  assert.equal(headerMap["x-frame-options"], "DENY", "X-Frame-Options must be DENY");

  // 2. X-Content-Type-Options: nosniff
  assert.equal(headerMap["x-content-type-options"], "nosniff", "X-Content-Type-Options must be nosniff");

  // 3. Referrer-Policy: strict-origin-when-cross-origin
  assert.equal(
    headerMap["referrer-policy"],
    "strict-origin-when-cross-origin",
    "Referrer-Policy must be strict-origin-when-cross-origin"
  );

  // 4. Content-Security-Policy: frame-ancestors 'none'
  assert.ok(
    headerMap["content-security-policy"]?.includes("frame-ancestors 'none'"),
    "Content-Security-Policy must include frame-ancestors 'none'"
  );

  // 5. Permissions-Policy
  assert.ok(
    headerMap["permissions-policy"],
    "Permissions-Policy header must be present"
  );
});

test("C-07: Backend CORS allowlist accepts authorized origins and rejects unauthorized origins", async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Authorized local origin
    const resLocal = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(resLocal.headers.get("access-control-allow-origin"), "http://localhost:5173");

    // 2. Authorized production origin
    const resProd = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: { Origin: "https://centerly-eg.com" },
    });
    assert.equal(resProd.headers.get("access-control-allow-origin"), "https://centerly-eg.com");

    // 3. Authorized project Vercel preview origin
    const resVercelAllowed = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: { Origin: "https://centrly-audit-preview-123.vercel.app" },
    });
    assert.equal(
      resVercelAllowed.headers.get("access-control-allow-origin"),
      "https://centrly-audit-preview-123.vercel.app"
    );

    // 4. Unauthorized arbitrary attacker on vercel.app
    const resVercelAttacker = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: { Origin: "https://evil-unrelated-app.vercel.app" },
    });
    assert.notEqual(
      resVercelAttacker.headers.get("access-control-allow-origin"),
      "https://evil-unrelated-app.vercel.app",
      "Arbitrary unapproved vercel.app domain must NOT be allowed by CORS"
    );

    // 5. Arbitrary malicious external origin
    const resEvil = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: { Origin: "https://malicious-attacker.com" },
    });
    assert.notEqual(
      resEvil.headers.get("access-control-allow-origin"),
      "https://malicious-attacker.com",
      "Malicious external domain must NOT be allowed by CORS"
    );
  } finally {
    server.close();
  }
});
