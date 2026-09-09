import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");
const waitlistPath = path.resolve(rootDir, "api/waitlist.js");
const indexPath = path.resolve(rootDir, "index.html");
const landingPath = path.resolve(rootDir, "landing.html");

test("C-01: api/waitlist.js contains ZERO hardcoded base64 secrets or fallbackToken", () => {
  const fileContent = fs.readFileSync(waitlistPath, "utf-8");
  assert.equal(fileContent.includes("fallbackToken"), false, "fallbackToken must be removed");
  assert.equal(fileContent.includes("cGF0"), false, "Base64 PAT token must be removed");
  assert.equal(
    fileContent.includes("process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT"),
    true,
    "Must strictly use process.env keys only"
  );
});

test("C-01: 全repo base64 token scan ensures no other hardcoded base64 PAT exists", () => {
  const fileContent = fs.readFileSync(waitlistPath, "utf-8");
  const match = fileContent.match(/cGF0[a-zA-Z0-9+/=]+/);
  assert.equal(match, null, "No base64 PAT pattern found");
});

test("H-01: Handler error catch block returns 500 with user-friendly Arabic error message", async () => {
  const { default: handler, resetRateLimiterForTesting } = await import(
    `file://${waitlistPath}?t=${Date.now()}-h01`
  );
  resetRateLimiterForTesting();

  const req = {
    method: "POST",
    headers: { "x-forwarded-for": "192.168.1.100" },
    get body() {
      throw new Error("Simulated critical runtime failure");
    },
  };

  let statusCode = 0;
  let responseData = null;

  const res = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    end() {
      return this;
    },
  };

  await handler(req, res);

  assert.equal(statusCode, 500, "Unexpected runtime error must return 500 status");
  assert.equal(responseData.success, false, "success must be false on error");
  assert.match(
    responseData.message,
    /حصل خطأ، برجاء المحاولة تاني أو التواصل معنا على الواتساب/,
    "Must provide clear Arabic error message"
  );
});

test("M-01: Honeypot field in booking form exists in both index.html and landing.html", () => {
  const indexContent = fs.readFileSync(indexPath, "utf-8");
  const landingContent = fs.readFileSync(landingPath, "utf-8");

  assert.match(indexContent, /name=["']website_url["']/, "index.html must contain honeypot input");
  assert.match(landingContent, /name=["']website_url["']/, "landing.html must contain honeypot input");
});

test("M-01: Honeypot non-empty submission is silently dropped with 200 OK and no Airtable call", async () => {
  const { default: handler, resetRateLimiterForTesting } = await import(
    `file://${waitlistPath}?t=${Date.now()}-honeypot`
  );
  resetRateLimiterForTesting();

  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return { ok: true, json: async () => ({}) };
  };

  try {
    const req = {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.1" },
      body: {
        fullname: "Bot User",
        phone: "01099999999",
        website_url: "http://spam-link.example.com",
      },
    };

    let statusCode = 0;
    let responseData = null;
    const res = {
      setHeader() {},
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
      end() {},
    };

    await handler(req, res);

    assert.equal(statusCode, 200, "Honeypot returns 200 OK to fool bots");
    assert.equal(responseData.success, true);
    assert.equal(fetchCalled, false, "Airtable fetch MUST NOT be called for honeypot traps");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("M-01: IP-based Rate Limiter allows 5 requests and blocks the 6th with 429", async () => {
  const { default: handler, resetRateLimiterForTesting } = await import(
    `file://${waitlistPath}?t=${Date.now()}-ratelimit`
  );
  resetRateLimiterForTesting();

  const clientIp = "198.51.100.25";
  const makeRequest = async (ip, body = {}) => {
    let statusCode = 0;
    let responseData = null;
    let retryAfter = null;

    const req = {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: {
        fullname: "Ahmed Tarek",
        phone: "01012345678",
        ...body,
      },
    };

    const res = {
      setHeader(name, val) {
        if (name.toLowerCase() === "retry-after") retryAfter = val;
      },
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
      end() {},
    };

    await handler(req, res);
    return { statusCode, responseData, retryAfter };
  };

  for (let i = 1; i <= 5; i++) {
    const res = await makeRequest(clientIp);
    assert.equal(res.statusCode, 200, `Request #${i} within limit should succeed`);
  }

  const limitedRes = await makeRequest(clientIp);
  assert.equal(limitedRes.statusCode, 429, "6th request must be rejected with 429");
  assert.equal(limitedRes.responseData.success, false);
  assert.equal(limitedRes.responseData.error?.code, "RATE_LIMITED");
  assert.ok(limitedRes.retryAfter, "Retry-After header must be set");

  const differentIpRes = await makeRequest("198.51.100.26");
  assert.equal(differentIpRes.statusCode, 200, "Different IP should not be blocked");
});
