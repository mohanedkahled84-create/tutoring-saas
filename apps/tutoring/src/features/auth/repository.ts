import { SupabaseClient } from "@supabase/supabase-js";
import { getScopedSupabaseClient } from "../../supabase.js";
import {
  LoginResult,
  SignupDTO,
  SignupResult,
  IAuthRepository,
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

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      token: data.session.access_token,
      expires_in: data.session.expires_in,
    };
  }

  async createTenantWithOwner(data: SignupDTO, trialEndsAt: string): Promise<SignupResult> {
    // 1. Create Supabase Auth User
    const { data: authUser, error: authErr } = await this.adminClient.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone },
    });

    if (authErr || !authUser.user) {
      throw new Error(authErr?.message || "Failed to create user");
    }

    const userId = authUser.user.id;

    // 2. Create Tenant with 14-day trial
    const { data: tenant, error: tenantErr } = await this.adminClient
      .from("tenants")
      .insert({
        name: data.tenant_name,
        status: "active",
        subscription_status: "trial",
        trial_ends_at: trialEndsAt,
      })
      .select()
      .single();

    if (tenantErr || !tenant) {
      throw new Error(tenantErr?.message || "Failed to create tenant");
    }

    // 3. Create Public User record linked as tenant owner
    const { error: userInsertErr } = await this.adminClient.from("users").insert({
      id: userId,
      tenant_id: tenant.id,
      email: data.email,
      role: "owner",
    });

    if (userInsertErr) {
      throw new Error(userInsertErr.message);
    }

    return {
      user: { id: userId, email: data.email },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        trial_ends_at: trialEndsAt,
        subscription_status: "trial",
      },
    };
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.publicClient.auth.resetPasswordForEmail(email.trim().toLowerCase());
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userClient = getScopedSupabaseClient(token);
    const { data, error } = await userClient.auth.updateUser({ password: newPassword });
    if (error || !data.user) {
      throw new Error(error?.message || "Password reset failed");
    }
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
      user: { id: user.id, email: user.email },
      token: `mock-jwt-token-${user.id}`,
      expires_in: 3600,
    };
  }

  async createTenantWithOwner(data: SignupDTO, trialEndsAt: string): Promise<SignupResult> {
    const tenantId = `tenant-${Date.now()}`;
    const userId = `user-${Date.now()}`;

    const tenant = {
      id: tenantId,
      name: data.tenant_name,
      trial_ends_at: trialEndsAt,
      subscription_status: "trial",
    };
    this.tenants.push(tenant);

    const user = {
      id: userId,
      email: data.email,
      password: data.password,
      tenant_id: tenantId,
      role: "owner",
    };
    this.users.push(user);

    return {
      user: { id: userId, email: data.email },
      tenant,
    };
  }

  async requestPasswordReset(_email: string): Promise<void> {
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
}
