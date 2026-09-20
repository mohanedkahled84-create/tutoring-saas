import test from "node:test";
import assert from "node:assert/strict";
import { authenticateUser, authClientResolver } from "../dist/shared/middleware/auth.js";

function createMockReq(token) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cookies: {},
    user: null,
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

test("AUTH FAILURE MODES - 401 when missing token", async () => {
  const req = createMockReq(null);
  const res = createMockRes();
  let nextCalled = false;

  await authenticateUser(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, "UNAUTHORIZED");
  assert.equal(nextCalled, false);
});

test("AUTH FAILURE MODES - 401 when token is invalid or expired in Supabase Auth", async () => {
  const originalPub = authClientResolver.supabasePublic;
  authClientResolver.supabasePublic = {
    auth: {
      async getUser(token) {
        return { data: { user: null }, error: { message: "jwt expired" } };
      },
    },
  };

  try {
    const req = createMockReq("expired-token");
    const res = createMockRes();
    let nextCalled = false;

    await authenticateUser(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
    assert.equal(nextCalled, false);
  } finally {
    authClientResolver.supabasePublic = originalPub;
  }
});

test("AUTH FAILURE MODES - 403 NO_PROFILE when user account exists but has no profile (PGRST116)", async () => {
  const originalPub = authClientResolver.supabasePublic;
  const originalScoped = authClientResolver.getScopedSupabaseClient;

  // Simulate RPC returning null and fallback query returning PGRST116 (0 rows)
  authClientResolver.supabasePublic = {
    auth: {
      async getUser(token) {
        return { data: { user: { id: "user-no-profile", email: "noprofile@example.com" } }, error: null };
      },
    },
    async rpc(name, params) {
      return { data: null, error: null };
    },
  };

  authClientResolver.getScopedSupabaseClient = (token) => ({
    from(table) {
      return {
        select(cols) {
          return {
            eq(col, val) {
              return {
                async single() {
                  return {
                    data: null,
                    error: {
                      code: "PGRST116",
                      message: "JSON object requested, multiple (or no) rows returned (0 rows)",
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  });

  try {
    const req = createMockReq("valid-token-no-profile");
    const res = createMockRes();
    let nextCalled = false;

    await authenticateUser(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, "NO_PROFILE");
    assert.equal(res.body.error.message, "لا يوجد ملف مستخدم مرتبط بهذا الحساب أو الحساب غير مفعل");
    assert.equal(nextCalled, false);
  } finally {
    authClientResolver.supabasePublic = originalPub;
    authClientResolver.getScopedSupabaseClient = originalScoped;
  }
});

test("AUTH FAILURE MODES - 503 AUTH_BACKEND_ERROR when PostgREST / DB error occurs (e.g. column missing)", async () => {
  const originalPub = authClientResolver.supabasePublic;
  const originalScoped = authClientResolver.getScopedSupabaseClient;

  // Simulate RPC error (e.g. 500) and fallback direct query returning 42703 (undefined_column)
  authClientResolver.supabasePublic = {
    auth: {
      async getUser(token) {
        return { data: { user: { id: "user-db-error", email: "error@example.com" } }, error: null };
      },
    },
    async rpc(name, params) {
      return { data: null, error: { message: "function get_user_profile does not exist", code: "42883" } };
    },
  };

  authClientResolver.getScopedSupabaseClient = (token) => ({
    from(table) {
      return {
        select(cols) {
          return {
            eq(col, val) {
              return {
                async single() {
                  return {
                    data: null,
                    error: {
                      code: "42703",
                      message: 'column users.financial_pin does not exist',
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  });

  try {
    const req = createMockReq("valid-token-db-error");
    const res = createMockRes();
    let nextCalled = false;

    await authenticateUser(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error.code, "AUTH_BACKEND_ERROR");
    assert.equal(res.body.error.message, "تعذر التحقق من بيانات الحساب مؤقتاً بسبب خطأ في الخادم. يرجى المحاولة بعد قليل.");
    assert.equal(nextCalled, false);
  } finally {
    authClientResolver.supabasePublic = originalPub;
    authClientResolver.getScopedSupabaseClient = originalScoped;
  }
});

test("AUTH FAILURE MODES - 200 & next() called when profile exists", async () => {
  const originalPub = authClientResolver.supabasePublic;
  const originalScoped = authClientResolver.getScopedSupabaseClient;

  authClientResolver.supabasePublic = {
    auth: {
      async getUser(token) {
        return { data: { user: { id: "user-ok", email: "user@example.com" } }, error: null };
      },
    },
    async rpc(name, params) {
      return {
        data: {
          id: "user-ok",
          tenant_id: "tenant-123",
          role: "owner",
          email: "user@example.com",
          full_name: "مستخدم تجريبي",
        },
        error: null,
      };
    },
  };

  try {
    const req = createMockReq("valid-token-ok");
    const res = createMockRes();
    let nextCalled = false;

    await authenticateUser(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(nextCalled, true);
    assert.equal(req.user.id, "user-ok");
    assert.equal(req.user.tenant_id, "tenant-123");
    assert.equal(req.user.role, "owner");
  } finally {
    authClientResolver.supabasePublic = originalPub;
    authClientResolver.getScopedSupabaseClient = originalScoped;
  }
});
