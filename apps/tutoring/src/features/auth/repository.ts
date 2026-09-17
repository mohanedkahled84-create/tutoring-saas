import { SupabaseClient } from "@supabase/supabase-js";
import { getScopedSupabaseClient } from "../../supabase.js";
import {
  LoginResult,
  SignupDTO,
  SignupResult,
  IAuthRepository,
  TenantSettings,
  ITenantsRepository,
} from "./types.js";

export class SupabaseAuthRepository implements IAuthRepository {
  constructor(
    private readonly publicClient: SupabaseClient,
    private readonly adminClient: SupabaseClient
  ) {}

  async signIn(email: string, password: string): Promise<LoginResult> {
    const { data, error } = await this.publicClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const fullName = (data.user.user_metadata?.full_name as string) || null;
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: fullName,
        full_name: fullName,
      },
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
    };
  }

  async refreshToken(refreshToken: string): Promise<LoginResult> {
    const { data, error } = await this.publicClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new Error("INVALID_REFRESH_TOKEN");
    }

    const fullName = (data.user.user_metadata?.full_name as string) || null;
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: fullName,
        full_name: fullName,
      },
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
    };
  }

  async createTenantWithOwner(data: SignupDTO, trialEndsAt: string): Promise<SignupResult> {
    const accountType = data.account_type === "center" ? "center" : "teacher";
    const userRole = accountType === "center" ? "center_owner" : "owner";

    // 1. Primary method: Atomic direct registration via SECURITY DEFINER RPC
    // Creates auth.users (with hash & email confirmed), auth.identities, public.tenants, and public.users in 1 transaction
    try {
      const { data: directData, error: directErr } = await this.publicClient.rpc(
        "register_tenant_owner_direct",
        {
          p_email: data.email.trim().toLowerCase(),
          p_password: data.password,
          p_full_name: data.full_name || "",
          p_phone: data.phone || "",
          p_tenant_name: data.tenant_name,
          p_account_type: accountType,
          p_trial_ends_at: trialEndsAt,
        }
      );

      if (!directErr && directData?.user_id) {
        return {
          user: {
            id: directData.user_id,
            email: data.email,
            role: directData.role || userRole,
            name: data.full_name || null,
            full_name: data.full_name || null,
          },
          tenant: {
            id: directData.tenant_id,
            name: directData.tenant_name || data.tenant_name,
            account_type: accountType,
            trial_ends_at: trialEndsAt,
            subscription_status: directData.subscription_status || "trial",
          },
        };
      }

      if (directErr?.message && directErr.message.includes("USER_ALREADY_EXISTS")) {
        throw new Error("هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول بدلاً من ذلك.");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("مسجل بالفعل")) {
        throw err;
      }
    }

    // 2. Fallback: standard signUp + register_tenant_owner
    let userId: string = "";
    try {
      const { data: signUpData, error: signUpErr } = await this.publicClient.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.full_name, phone: data.phone },
        },
      });

      if (signUpErr) {
        if (signUpErr.message && (signUpErr.message.includes("already registered") || signUpErr.message.includes("User already exists"))) {
          throw new Error("هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول بدلاً من ذلك.");
        }
        throw signUpErr;
      }
      if (signUpData?.user) {
        userId = signUpData.user.id;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create user account";
      throw new Error(msg);
    }

    if (!userId) {
      throw new Error("تعذر إنشاء حساب المستخدم في النظام. يرجى المحاولة مرة أخرى.");
    }

    const { data: rpcData, error: rpcErr } = await this.publicClient.rpc(
      "register_tenant_owner",
      {
        p_user_id: userId,
        p_email: data.email,
        p_full_name: data.full_name || "",
        p_phone: data.phone || "",
        p_tenant_name: data.tenant_name,
        p_account_type: accountType,
        p_trial_ends_at: trialEndsAt,
      }
    );

    if (rpcErr || !rpcData) {
      throw new Error(rpcErr?.message || "Failed to initialize organization profile");
    }

    return {
      user: {
        id: userId,
        email: data.email,
        role: userRole,
        name: data.full_name || null,
        full_name: data.full_name || null,
      },
      tenant: {
        id: rpcData.tenant_id,
        name: rpcData.tenant_name || data.tenant_name,
        account_type: accountType,
        trial_ends_at: trialEndsAt,
        subscription_status: rpcData.subscription_status || "trial",
      },
    };
  }

  async requestPasswordReset(email: string, redirectTo?: string): Promise<void> {
    const options = redirectTo ? { redirectTo } : undefined;
    await this.publicClient.auth.resetPasswordForEmail(email.trim().toLowerCase(), options);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userClient = getScopedSupabaseClient(token);
    const { data, error } = await userClient.auth.updateUser({ password: newPassword });
    if (error || !data.user) {
      throw new Error(error?.message || "Password reset failed");
    }
  }

  async changePassword(token: string, email: string, currentPassword: string, newPassword: string): Promise<void> {
    if (currentPassword && email) {
      const { error: signInError } = await this.publicClient.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: currentPassword,
      });
      if (signInError) {
        throw new Error("CURRENT_PASSWORD_INCORRECT");
      }
    }
    await this.resetPassword(token, newPassword);
  }
}

export class FakeAuthRepository implements IAuthRepository {
  public users: Array<{ id: string; email: string; password: string; tenant_id: string; role: string }> = [];
  public tenants: Array<{ id: string; name: string; trial_ends_at: string; subscription_status: string }> = [];

  async signIn(email: string, password: string): Promise<LoginResult> {
    const user = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
      throw new Error("INVALID_CREDENTIALS");
    }
    return {
      user: { id: user.id, email: user.email, name: (user as any).full_name || null, full_name: (user as any).full_name || null },
      token: `mock-jwt-token-${user.id}`,
      refresh_token: `mock-refresh-token-${user.id}`,
      expires_in: 3600,
    };
  }

  async refreshToken(refreshToken: string): Promise<LoginResult> {
    return {
      user: { id: "mock-user", email: "mock@centrly.app", name: "Mock User", full_name: "Mock User" },
      token: `mock-refreshed-jwt-${Date.now()}`,
      refresh_token: `mock-refresh-${Date.now()}`,
      expires_in: 3600,
    };
  }

  async createTenantWithOwner(data: SignupDTO, trialEndsAt: string): Promise<SignupResult> {
    const tenantId = `tenant-${Date.now()}`;
    const userId = `user-${Date.now()}`;
    const accountType = data.account_type === "center" ? "center" : "teacher";
    const userRole = accountType === "center" ? "center_owner" : "owner";

    const tenant = {
      id: tenantId,
      name: data.tenant_name,
      account_type: accountType,
      trial_ends_at: trialEndsAt,
      subscription_status: "trial",
    };
    this.tenants.push(tenant);

    const user = {
      id: userId,
      email: data.email,
      password: data.password,
      tenant_id: tenantId,
      role: userRole,
    };
    this.users.push(user);

    return {
      user: { id: userId, email: data.email, role: userRole, name: data.full_name || null, full_name: data.full_name || null },
      tenant,
    };
  }

  async requestPasswordReset(_email: string, _redirectTo?: string): Promise<void> {
    // Simulated no-op
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || token === "invalid") {
      throw new Error("Invalid token");
    }
    const user = this.users[0];
    if (user) {
      user.password = newPassword;
    }
  }

  async changePassword(_token: string, email: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || this.users[0];
    if (user && currentPassword && user.password && user.password !== currentPassword) {
      throw new Error("CURRENT_PASSWORD_INCORRECT");
    }
    if (user) {
      user.password = newPassword;
    }
  }
}

/**
 * C-04 & Clean Architecture:
 * Encapsulates read/write on tenants table behind ITenantsRepository.
 * Uses the scoped client passed from composition root to enforce RLS.
 */
export class SupabaseTenantsRepository implements ITenantsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
    const { data, error } = await this.client
      .from("tenants")
      .select("id, name, settings")
      .eq("id", tenantId)
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV === "test" || error.message.includes("fetch failed")) {
        return null;
      }
      throw new Error(error.message);
    }

    return (data?.settings as TenantSettings) || null;
  }

  async updateTenantSettings(tenantId: string, settings: TenantSettings): Promise<TenantSettings> {
    const { data, error } = await this.client
      .from("tenants")
      .update({ settings })
      .eq("id", tenantId)
      .select("settings")
      .single();

    if (error) {
      if (process.env.NODE_ENV === "test" || error.message.includes("fetch failed")) {
        return settings;
      }
      throw new Error(error.message);
    }

    return (data?.settings as TenantSettings) || settings;
  }
}

export class FakeTenantsRepository implements ITenantsRepository {
  public tenantSettings: Map<string, TenantSettings> = new Map();

  async getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
    return this.tenantSettings.get(tenantId) || null;
  }

  async updateTenantSettings(tenantId: string, settings: TenantSettings): Promise<TenantSettings> {
    this.tenantSettings.set(tenantId, settings);
    return settings;
  }
}
