import { Router, Request, Response } from "express";
import { supabasePublic, getServiceSupabaseClient, getScopedSupabaseClient } from "../supabase.js";
import { validatePasswordStrength, extractToken } from "../middleware/auth.js";
import { alertFounderOfNewSignup } from "../services/founderAlertService.js";
import { AuthenticatedRequest } from "../types/index.js";

export const authRouter = Router();

// In-memory brute-force attempt tracker: email -> { count, lockedUntil }
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

// POST /api/auth/login - Rate-limited, brute-force protected login
authRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Email and password are required" } });
    return;
  }

  const key = email.toLowerCase().trim();
  const bruteCheck = checkBruteForce(key);
  if (!bruteCheck.allowed) {
    res.status(429).json({
      error: {
        code: "ACCOUNT_LOCKED",
        message: `Too many failed login attempts. Account temporarily locked for ${bruteCheck.waitTimeMinutes} minutes.`,
      },
    });
    return;
  }

  try {
    const { data, error } = await supabasePublic.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      recordFailedLogin(key);
      res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
      return;
    }

    resetLoginAttempts(key);

    res.cookie("access_token", data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: data.session.expires_in * 1000,
    });

    res.json({
      message: "Login successful",
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      token: data.session.access_token,
      expires_in: data.session.expires_in,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// DEV-SA.1 & DEV-SL.1: POST /api/auth/signup - Teacher registration with 14-day trial & founder alert
authRouter.post("/signup", async (req: Request, res: Response): Promise<void> => {
  const { email, password, full_name, tenant_name, phone, subject, governorate } = req.body;

  if (!email || !password || !tenant_name) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "email, password, and tenant_name are required" },
    });
    return;
  }

  const pwdCheck = validatePasswordStrength(password);
  if (!pwdCheck.valid) {
    res.status(400).json({ error: { code: "WEAK_PASSWORD", message: pwdCheck.reason } });
    return;
  }

  const supabaseAdmin = getServiceSupabaseClient();

  try {
    // 1. Create Supabase Auth User
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone },
    });

    if (authErr || !authUser.user) {
      res.status(400).json({ error: { code: "AUTH_ERROR", message: authErr?.message || "Failed to create user" } });
      return;
    }

    const userId = authUser.user.id;
    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // 2. Create Tenant with 14-day trial
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: tenant_name,
        status: "active",
        subscription_status: "trial",
        trial_ends_at: trialEnds,
      })
      .select()
      .single();

    if (tenantErr || !tenant) {
      res.status(500).json({ error: { code: "TENANT_CREATION_FAILED", message: tenantErr?.message } });
      return;
    }

    // 3. Create Public User record linked as tenant owner
    await supabaseAdmin.from("users").insert({
      id: userId,
      tenant_id: tenant.id,
      email,
      role: "owner",
    });

    // 4. DEV-SA.1: Dispatch founder alert asynchronously (never blocks response)
    alertFounderOfNewSignup({
      teacher_name: full_name || email,
      teacher_email: email,
      teacher_phone: phone,
      tenant_name,
      subject,
      governorate,
      trial_ends_at: trialEnds,
    }).catch(() => {});

    res.status(201).json({
      message: "Signup successful. Your 14-day free trial is active.",
      user: { id: userId, email },
      tenant: { id: tenant.id, name: tenant.name, trial_ends_at: trialEnds, subscription_status: "trial" },
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// DEV-PR.1: POST /api/auth/forgot-password - Request password reset email
authRouter.post("/forgot-password", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Email is required" } });
    return;
  }

  try {
    // Send reset email via Supabase Auth
    await supabasePublic.auth.resetPasswordForEmail(email.trim().toLowerCase());

    // Generic safe response to prevent email enumeration
    res.json({
      message: "If that email is registered, a password recovery link has been sent.",
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Password reset request failed" } });
  }
});

// DEV-PR.1: POST /api/auth/reset-password - Complete password reset using user session/token
authRouter.post("/reset-password", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const token = extractToken(req) || req.body.token;
  const { password } = req.body;

  if (!token || !password) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "token and new password are required" },
    });
    return;
  }

  const pwdCheck = validatePasswordStrength(password);
  if (!pwdCheck.valid) {
    res.status(400).json({ error: { code: "WEAK_PASSWORD", message: pwdCheck.reason } });
    return;
  }

  try {
    const userClient = getScopedSupabaseClient(token);
    const { data, error } = await userClient.auth.updateUser({ password });

    if (error || !data.user) {
      res.status(400).json({
        error: { code: "RESET_FAILED", message: error?.message || "Password reset failed" },
      });
      return;
    }

    res.json({ message: "Password updated successfully. You can now login with your new password." });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// POST /api/auth/validate-password - Validates password strength policy
authRouter.post("/validate-password", (req: Request, res: Response): void => {
  const { password } = req.body;
  const result = validatePasswordStrength(password);
  res.json(result);
});
