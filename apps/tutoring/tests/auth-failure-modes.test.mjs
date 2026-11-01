import test from "node:test";
import assert from "node:assert/strict";
import { authenticateUser, authClientResolver, requireAdmin, profileHasSecurityPin } from "../dist/shared/middleware/auth.js";

test('retired financial PIN stays off even for old profile contracts and unknown state',()=>{
  assert.equal(profileHasSecurityPin({has_security_pin:false}),false);
  assert.equal(profileHasSecurityPin({has_security_pin:true}),false);
  assert.equal(profileHasSecurityPin({financial_pin_hash:null}),false);
  assert.equal(profileHasSecurityPin({financial_pin_hash:'opaque'}),false);
  assert.equal(profileHasSecurityPin({}),false);
  assert.equal(profileHasSecurityPin(null),false);
});

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
  };

  authClientResolver.getScopedSupabaseClient = (token) => ({
    async rpc() {
      return { data: null, error: null };
    },
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
  };

  authClientResolver.getScopedSupabaseClient = (token) => ({
    async rpc() {
      return { data: null, error: { message: "function get_user_profile does not exist", code: "42883" } };
    },
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
  };
  authClientResolver.getScopedSupabaseClient = () => ({
    async rpc() {
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
  });

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

test("AUTH PLATFORM ADMIN - stored admin role passes requireAdmin", async () => {
  const originalPub = authClientResolver.supabasePublic;
  const originalScoped = authClientResolver.getScopedSupabaseClient;

  authClientResolver.supabasePublic = {
    auth: {
      async getUser(token) {
        return { data: { user: { id: "founder-1", email: "mohanedkahled84@gmail.com" } }, error: null };
      },
    },
  };
  authClientResolver.getScopedSupabaseClient = () => ({
    async rpc() {
      return {
        data: {
          id: "founder-1",
          tenant_id: "tenant-hq",
          role: "admin", // Administrative authority is stored in the database.
          email: "mohanedkahled84@gmail.com",
          full_name: "مهند خالد",
        },
        error: null,
      };
    },
  });

  try {
    const req = createMockReq("valid-founder-token");
    const res = createMockRes();
    let authNextCalled = false;

    await authenticateUser(req, res, () => {
      authNextCalled = true;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(authNextCalled, true);
    assert.equal(req.user.email, "mohanedkahled84@gmail.com");
    assert.equal(req.user.role, "admin");

    // Test requireAdmin allows founder
    let roleNextCalled = false;
    const roleRes = createMockRes();
    requireAdmin(req, roleRes, () => {
      roleNextCalled = true;
    });
    assert.equal(roleNextCalled, true);
    assert.equal(roleRes.statusCode, 200);
  } finally {
    authClientResolver.supabasePublic = originalPub;
    authClientResolver.getScopedSupabaseClient = originalScoped;
  }
});

test("AUTH PLATFORM ADMIN - legacy email and editable metadata cannot elevate a stored owner", async () => {
  const originalPub = authClientResolver.supabasePublic;
  const originalScoped = authClientResolver.getScopedSupabaseClient;
  authClientResolver.supabasePublic = { auth: { async getUser() {
    return { data: { user: { id: 'owner-legacy', email: 'mohanedkahled84@gmail.com',
      user_metadata: { role: 'admin', is_superadmin: true } } }, error: null };
  } } };
  authClientResolver.getScopedSupabaseClient = () => ({ async rpc() {
    return { data: { id: 'owner-legacy', tenant_id: 'tenant-normal', role: 'owner',
      email: 'mohanedkahled84@gmail.com', has_security_pin: true }, error: null };
  } });
  try {
    const req = createMockReq('verified-token');
    const res = createMockRes();
    let authenticated = false;
    await authenticateUser(req, res, () => { authenticated = true; });
    assert.equal(authenticated, true);
    assert.equal(req.user.role, 'owner');
    assert.equal(req.user.has_security_pin, false);
    const denied = createMockRes(); let granted = false;
    requireAdmin(req, denied, () => { granted = true; });
    assert.equal(granted, false);
    assert.equal(denied.statusCode, 403);
  } finally {
    authClientResolver.supabasePublic = originalPub;
    authClientResolver.getScopedSupabaseClient = originalScoped;
  }
});

test("AUTH REGULAR OWNER - regular owner cannot access admin-only endpoints", () => {
  const req = {
    user: {
      id: "regular-teacher",
      email: "teacher@regularschool.com",
      role: "owner",
      tenant_id: "tenant-normal",
    },
  };
  const res = createMockRes();
  let nextCalled = false;

  requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, "FORBIDDEN");
});
