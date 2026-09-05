import {
  LoginDTO,
  LoginResult,
  SignupDTO,
  SignupResult,
  ResetPasswordDTO,
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
    if (!dto.email || !dto.password) {
      throw new Error("MISSING_CREDENTIALS");
    }

    const key = dto.email.toLowerCase().trim();
    const bruteCheck = checkBruteForce(key);
    if (!bruteCheck.allowed) {
      const err = new Error(`Too many failed login attempts. Account temporarily locked for ${bruteCheck.waitTimeMinutes} minutes.`);
      (err as Error & { code?: string }).code = "ACCOUNT_LOCKED";
      throw err;
    }

    try {
      const result = await this.repo.signIn(dto.email, dto.password);
      resetLoginAttempts(key);
      return result;
    } catch (err: unknown) {
      recordFailedLogin(key);
      throw err;
    }
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
    if (!dto.email || !dto.password || !dto.tenant_name) {
      throw new Error("MISSING_SIGNUP_FIELDS");
    }

    const pwdCheck = this.validatePassword(dto.password);
    if (!pwdCheck.valid) {
      const err = new Error(pwdCheck.reason || "Weak password");
      (err as Error & { code?: string }).code = "WEAK_PASSWORD";
      throw err;
    }

    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const result = await this.repo.createTenantWithOwner(dto, trialEnds);

    if (onNewSignup) {
      onNewSignup({
        teacher_name: dto.full_name || dto.email,
        teacher_email: dto.email,
        teacher_phone: dto.phone,
        tenant_name: dto.tenant_name,
        subject: dto.subject,
        governorate: dto.governorate,
        trial_ends_at: trialEnds,
        account_type: dto.account_type,
      }).catch(() => {});
    }

    return result;
  }

  async forgotPassword(email: string): Promise<void> {
    if (!email) {
      throw new Error("MISSING_EMAIL");
    }
    await this.repo.requestPasswordReset(email);
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
}
