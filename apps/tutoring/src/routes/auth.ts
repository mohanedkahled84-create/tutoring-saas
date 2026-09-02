import { Router, Request, Response } from "express";
import { supabasePublic } from "../supabase.js";
import { validatePasswordStrength } from "../middleware/auth.js";

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

  // If lockout expired, reset
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

  // Check brute force lockout
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

    // Login succeeded, reset attempts
    resetLoginAttempts(key);

    // DEV-AUTH.1: Set httpOnly cookie to protect against XSS token leakage
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

// POST /api/auth/validate-password - Validates password strength policy
authRouter.post("/validate-password", (req: Request, res: Response): void => {
  const { password } = req.body;
  const result = validatePasswordStrength(password);
  res.json(result);
});
