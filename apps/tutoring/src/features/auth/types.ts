export interface LoginDTO {
  email: string;
  password: string;
}

export interface LoginResult {
  user: {
    id: string;
    email?: string;
    name?: string | null;
    full_name?: string | null;
  };
  token: string;
  refresh_token?: string;
  expires_in: number;
}

export interface SignupDTO {
  email: string;
  password: string;
  full_name?: string;
  tenant_name: string;
  phone?: string;
  subject?: string;
  governorate?: string;
  account_type?: "teacher" | "center";
}

export interface SignupResult {
  user: {
    id: string;
    email?: string;
    role?: string;
    name?: string | null;
    full_name?: string | null;
  };
  tenant: {
    id: string;
    name: string;
    account_type?: string;
    trial_ends_at: string;
    subscription_status: string;
  };
}

export interface ResetPasswordDTO {
  token: string;
  password: string;
}

export interface ChangePasswordDTO {
  token: string;
  email: string;
  current_password?: string;
  new_password: string;
}

export interface IAuthRepository {
  signIn(email: string, password: string): Promise<LoginResult>;
  refreshToken?(refreshToken: string): Promise<LoginResult>;
  createTenantWithOwner(data: SignupDTO, trialEndsAt: string): Promise<SignupResult>;
  requestPasswordReset(email: string, redirectTo?: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  changePassword?(token: string, email: string, currentPassword: string, newPassword: string): Promise<void>;
}

export interface TenantSettings {
  homework_submission?: "in_session" | "online_before_session";
  auto_notification?: boolean;
  enable_top_performers?: boolean;
  [key: string]: unknown;
}

export interface ITenantsRepository {
  getTenantSettings(tenantId: string): Promise<TenantSettings | null>;
  updateTenantSettings(tenantId: string, settings: TenantSettings): Promise<TenantSettings>;
}
