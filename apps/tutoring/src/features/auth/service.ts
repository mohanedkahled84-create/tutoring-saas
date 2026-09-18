import {
  LoginDTO,
  LoginResult,
  SignupDTO,
  SignupResult,
  ResetPasswordDTO,
  ChangePasswordDTO,
  VerifyEmailDTO,
  VerifyEmailResult,
  ResendVerificationDTO,
  IAuthRepository,
} from "./types.js";
import { validatePasswordStrength } from "../../shared/middleware/auth.js";

const loginAttempts = new Map<string, { count: number; lockedUntil?: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function checkBruteForce(key: string): { allowed: boolean; waitTimeMinutes?: number } {
  const record = loginAttempts.get(key);
  if (!record) return { allowed: true };

  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    const remainingMs = record.lockedUntil - Date.now();
    return { allowed: false, waitTimeMinutes: Math.ceil(remainingMs / (60 * 1000)) };
  }

  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    loginAttempts.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedLogin(key: string): void {
  const record = loginAttempts.get(key) || { count: 0 };
  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }

  loginAttempts.set(key, record);
}

export function resetLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

export class AuthService {
  constructor(private readonly repo: IAuthRepository) {}

  validatePassword(password: string): { valid: boolean; reason?: string } {
    return validatePasswordStrength(password);
  }

  async login(dto: LoginDTO): Promise<LoginResult> {
    const rawIdentifier = dto.email ? dto.email.trim() : "";
    const password = dto.password ? dto.password.trim() : "";
    if (!rawIdentifier || !password) {
      throw new Error("MISSING_CREDENTIALS");
    }

    const bruteForceKey = rawIdentifier.toLowerCase();
    const bruteCheck = checkBruteForce(bruteForceKey);
    if (!bruteCheck.allowed) {
      const err = new Error(`Too many failed login attempts. Account temporarily locked for ${bruteCheck.waitTimeMinutes} minutes.`);
      (err as Error & { code?: string }).code = "ACCOUNT_LOCKED";
      throw err;
    }

    try {
      const result = await this.repo.signIn(rawIdentifier, password);
      resetLoginAttempts(bruteForceKey);
      return result;
    } catch (err: unknown) {
      if ((err as Error & { code?: string })?.code !== "EMAIL_NOT_VERIFIED") {
        recordFailedLogin(bruteForceKey);
      }
      throw err;
    }
  }

  async verifyEmail(dto: VerifyEmailDTO): Promise<VerifyEmailResult> {
    const email = dto.email ? dto.email.trim().toLowerCase() : "";
    const code = dto.code ? dto.code.trim() : "";
    if (!email || !code) {
      throw new Error("MISSING_VERIFICATION_FIELDS");
    }
    return await this.repo.verifyEmail({
      email,
      code,
      password: dto.password ? dto.password.trim() : undefined,
    });
  }

  async resendVerification(dto: ResendVerificationDTO): Promise<{ success: boolean; message: string }> {
    const email = dto.email ? dto.email.trim().toLowerCase() : "";
    if (!email) {
      throw new Error("MISSING_EMAIL");
    }
    return await this.repo.resendVerification({ email });
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    if (!refreshToken) {
      throw new Error("MISSING_REFRESH_TOKEN");
    }
    if (typeof this.repo.refreshToken === "function") {
      return await this.repo.refreshToken(refreshToken);
    }
    throw new Error("REFRESH_NOT_SUPPORTED");
  }

  async signup(
    dto: SignupDTO,
    onNewSignup?: (payload: {
      teacher_name: string;
      teacher_email: string;
      teacher_phone?: string;
      tenant_name: string;
      subject?: string;
      governorate?: string;
      trial_ends_at?: string;
      account_type?: "teacher" | "center";
    }) => Promise<void>
  ): Promise<SignupResult> {
    const normalizedDto: SignupDTO = {
      ...dto,
      email: dto.email ? dto.email.trim().toLowerCase() : "",
      password: dto.password ? dto.password.trim() : "",
      tenant_name: dto.tenant_name ? dto.tenant_name.trim() : "",
    };

    if (!normalizedDto.email || !normalizedDto.password || !normalizedDto.tenant_name) {
      throw new Error("MISSING_SIGNUP_FIELDS");
    }

    const pwdCheck = this.validatePassword(normalizedDto.password);
    if (!pwdCheck.valid) {
      const err = new Error(pwdCheck.reason || "Weak password");
      (err as Error & { code?: string }).code = "WEAK_PASSWORD";
      throw err;
    }

    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const result = await this.repo.createTenantWithOwner(normalizedDto, trialEnds);

    if (onNewSignup) {
      onNewSignup({
        teacher_name: normalizedDto.full_name || normalizedDto.email,
        teacher_email: normalizedDto.email,
        teacher_phone: normalizedDto.phone,
        tenant_name: normalizedDto.tenant_name,
        subject: normalizedDto.subject,
        governorate: normalizedDto.governorate,
        trial_ends_at: trialEnds,
        account_type: normalizedDto.account_type,
      }).catch(() => {});
    }

    return result;
  }

  async signUp(dto: any): Promise<any> {
    const res = await this.signup({
      ...dto,
      full_name: dto.name || dto.full_name,
    });
    return {
      ...res,
      token: (res as any).token || `mock-jwt-${res.user.id}`,
      user: {
        ...res.user,
        name: dto.name || dto.full_name || res.user.name,
        role: res.user.role || (dto.account_type === "center" ? "center_owner" : "teacher"),
      },
    };
  }

  async signIn(emailOrPhone: string, password: string): Promise<LoginResult> {
    return await this.login({ email: emailOrPhone, password });
  }

  async forgotPassword(email: string, redirectTo?: string): Promise<void> {
    const normalizedEmail = email ? email.trim().toLowerCase() : "";
    if (!normalizedEmail) {
      throw new Error("MISSING_EMAIL");
    }
    await this.repo.requestPasswordReset(normalizedEmail, redirectTo);
  }

  async resetPassword(dto: ResetPasswordDTO): Promise<void> {
    if (!dto.token || !dto.password) {
      throw new Error("MISSING_RESET_DATA");
    }

    const pwdCheck = this.validatePassword(dto.password);
    if (!pwdCheck.valid) {
      const err = new Error(pwdCheck.reason || "Weak password");
      (err as Error & { code?: string }).code = "WEAK_PASSWORD";
      throw err;
    }

    await this.repo.resetPassword(dto.token, dto.password);
  }

  async changePassword(dto: ChangePasswordDTO): Promise<void> {
    if (!dto.token || !dto.new_password) {
      throw new Error("MISSING_PASSWORD_FIELDS");
    }

    const pwdCheck = this.validatePassword(dto.new_password);
    if (!pwdCheck.valid) {
      const err = new Error(pwdCheck.reason || "Weak password");
      (err as Error & { code?: string }).code = "WEAK_PASSWORD";
      throw err;
    }

    if (typeof this.repo.changePassword === "function") {
      await this.repo.changePassword(dto.token, dto.email, dto.current_password || "", dto.new_password);
    } else {
      await this.repo.resetPassword(dto.token, dto.new_password);
    }
  }
}
