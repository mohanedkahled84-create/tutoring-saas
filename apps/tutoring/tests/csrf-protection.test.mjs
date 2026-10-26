import test from "node:test";
import assert from "node:assert/strict";
import { createCookieCsrfGuard } from "../dist/shared/middleware/csrf.js";

function runGuard({ method = "POST", cookies = {}, headers = {} } = {}) {
  const req = {
    method,
    cookies,
    get(name) {
      return headers[name.toLowerCase()];
    },
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  createCookieCsrfGuard((origin) => origin === "https://centerly-eg.com")(
    req,
    res,
    () => { nextCalled = true; },
  );
  return { res, nextCalled };
}

test("CSRF: rejects cookie-authenticated state changes without an allowed Origin", () => {
  for (const headers of [{}, { origin: "https://attacker.example" }]) {
    const { res, nextCalled } = runGuard({
      cookies: { access_token: "session-cookie" },
      headers,
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, "CSRF_FORBIDDEN");
    assert.equal(nextCalled, false);
  }
});

test("CSRF: allows same-origin cookie requests and requests with an explicit bearer token", () => {
  const allowedOrigin = runGuard({
    cookies: { access_token: "session-cookie" },
    headers: { origin: "https://centerly-eg.com", "sec-fetch-site": "same-site" },
  });
  assert.equal(allowedOrigin.nextCalled, true);

  const bearer = runGuard({
    cookies: { access_token: "session-cookie" },
    headers: { authorization: "Bearer explicit-token", "sec-fetch-site": "cross-site" },
  });
  assert.equal(bearer.nextCalled, true);
});

test("CSRF: safe methods do not require an Origin header", () => {
  const { res, nextCalled } = runGuard({
    method: "GET",
    cookies: { access_token: "session-cookie" },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
});
