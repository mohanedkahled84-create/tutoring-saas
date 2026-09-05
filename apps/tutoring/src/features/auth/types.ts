export interface LoginDTO {
  email: string;
  password: string;
}

export interface LoginResult {
  user: {
    id: string;
    email?: string;
  };
  token: string;
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

export interface IAuthRepository {
  signIn(email: string, password: string): Promise<LoginResult>;
  createTenantWithOwner(data: SignupDTO, trialEndsAt: string): Promise<SignupResult>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
}
