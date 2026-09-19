import { Router, Request, Response } from "express";
import { getServices } from "../../composition.js";
import { extractToken, authenticateUser } from "../../shared/middleware/auth.js";
import { getScopedSupabaseClient } from "../../supabase.js";
import { authRateLimiter } from "../../shared/middleware/rateLimit.js";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { dispatchAdminAlertWebhook } from "../admin-ops/index.js";

export const authRouter = Router();

// POST /api/auth/login - Rate-limited, brute-force protected login
authRouter.post("/login", authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const rawIdentifier =
    typeof req.body.email === "string"
      ? req.body.email.trim()
      : typeof req.body.identifier === "string"
      ? req.body.identifier.trim()
      : typeof req.body.phone === "string"
      ? req.body.phone.trim()
      : "";
  const password = typeof req.body.password === "string" ? req.body.password.trim() : "";

  if (!rawIdentifier || !password) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Email or phone and password are required" } });
    return;
  }

  try {
    const authService = getServices(req as AuthenticatedRequest).auth;
    const result = await authService.login({ email: rawIdentifier, password });

    res.cookie("access_token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: result.expires_in * 1000,
    });

    let hasSecurityPin = false;
    try {
      const client = getScopedSupabaseClient(result.token);
      const { data: uRec } = await client
        .from("users")
        .select("financial_pin, tenant_id")
        .eq("id", result.user.id)
        .maybeSingle();

      if (uRec?.financial_pin) {
        hasSecurityPin = true;
      } else if (uRec?.tenant_id) {
        const { data: tRec } = await client
          .from("tenants")
          .select("settings")
          .eq("id", uRec.tenant_id)
          .maybeSingle();
        if (tRec?.settings?.financial_pin) {
          hasSecurityPin = true;
        }
      }
    } catch (_) {}

    res.json({
      message: "Login successful",
      user: {
        ...result.user,
        has_security_pin: hasSecurityPin,
      },
      token: result.token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      if ((err as Error & { code?: string }).code === "EMAIL_NOT_VERIFIED") {
        const unverifiedEmail = (err as Error & { email?: string }).email || rawIdentifier;
        res.status(403).json({
          error: {
            code: "EMAIL_NOT_VERIFIED",
            message: "يرجى تأكيد بريدك الإلكتروني أولاً قبل تسجيل الدخول. تم إرسال رمز التحقق إلى بريدك.",
            email: unverifiedEmail,
          },
        });
        return;
      }
      if ((err as Error & { code?: string }).code === "ACCOUNT_LOCKED") {
        res.status(429).json({ error: { code: "ACCOUNT_LOCKED", message: err.message } });
        return;
      }
      if (err.message === "INVALID_CREDENTIALS") {
        res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "البريد الإلكتروني أو رقم الهاتف أو كلمة المرور غير صحيحة" } });
        return;
      }
    }
    const message = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// POST /api/auth/refresh - Refresh access token using refresh token
authRouter.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "refresh_token is required" } });
    return;
  }

  try {
    const authService = getServices(req as AuthenticatedRequest).auth;
    const result = await authService.refresh(refresh_token);

    let hasSecurityPin = false;
    try {
      const client = getScopedSupabaseClient(result.token);
      const { data: uRec } = await client
        .from("users")
        .select("id, tenant_id, role, full_name, teacher_id, assistant_id, financial_pin")
        .eq("id", result.user.id)
        .maybeSingle();

      if (uRec) {
        if (uRec.role) (result.user as any).role = uRec.role;
        if (uRec.tenant_id) (result.user as any).tenant_id = uRec.tenant_id;
        if (uRec.teacher_id) (result.user as any).teacher_id = uRec.teacher_id;
        if (uRec.assistant_id) (result.user as any).assistant_id = uRec.assistant_id;
        if (uRec.full_name) {
          result.user.name = uRec.full_name;
          result.user.full_name = uRec.full_name;
        }
        if (uRec.financial_pin) {
          hasSecurityPin = true;
        } else if (uRec.tenant_id) {
          const { data: tRec } = await client
            .from("tenants")
            .select("settings, account_type")
            .eq("id", uRec.tenant_id)
            .maybeSingle();
          if (tRec?.settings?.financial_pin) {
            hasSecurityPin = true;
          }
          if (tRec?.account_type) {
            (result.user as any).account_type = tRec.account_type;
          }
        }
      }
    } catch (_) {}

    res.cookie("access_token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: result.expires_in * 1000,
    });

    res.json({
      message: "Token refreshed successfully",
      user: {
        ...result.user,
        has_security_pin: hasSecurityPin,
      },
      token: result.token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to refresh session token";
    res.status(401).json({ error: { code: "UNAUTHORIZED", message } });
  }
});

// DEV-SA.1 & DEV-SL.1: POST /api/auth/signup - Teacher registration with 14-day trial & founder alert
authRouter.post("/signup", authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password, full_name, tenant_name, phone, subject, governorate, account_type } = req.body;

  if (!email || !password || !tenant_name) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "email, password, and tenant_name are required" },
    });
    return;
  }

  try {
    const services = getServices(req as AuthenticatedRequest);
    const authService = services.auth;
    const adminOpsService = services.adminOps;

    const normalizedAccountType: "teacher" | "center" =
      account_type === "center" ? "center" : "teacher";

    const result = await authService.signup(
      {
        email,
        password,
        full_name,
        tenant_name,
        phone,
        subject,
        governorate,
        account_type: normalizedAccountType,
      },
      async (payload) => {
        if (adminOpsService && typeof adminOpsService.alertFounder === "function") {
          await adminOpsService.alertFounder(payload);
        }
        dispatchAdminAlertWebhook({
          event_type: "new_signup",
          teacher_name: payload.teacher_name,
          teacher_email: payload.teacher_email,
          teacher_phone: payload.teacher_phone,
          tenant_name: payload.tenant_name,
          account_type: payload.account_type,
          subject: payload.subject,
          governorate: payload.governorate,
          trial_ends_at: payload.trial_ends_at,
          created_at: new Date().toISOString(),
        }).catch(() => {});
      }
    );

    res.status(201).json({
      message: "تم إنشاء الحساب بنجاح. يرجى تأكيد بريدك الإلكتروني للمتابعة.",
      requires_verification: true,
      email: email.trim().toLowerCase(),
      user: result.user,
      tenant: result.tenant,
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err as Error & { code?: string }).code === "WEAK_PASSWORD") {
      res.status(400).json({ error: { code: "WEAK_PASSWORD", message: err.message } });
      return;
    }
    const message = err instanceof Error ? err.message : "Signup failed";
    res.status(400).json({ error: { code: "AUTH_ERROR", message } });
  }
});

// POST /api/auth/verify-email - Verify 6-digit OTP code and activate session
authRouter.post("/verify-email", authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password.trim() : undefined;

  if (!email || !code) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "البريد الإلكتروني ورمز التحقق مطلوبان" },
    });
    return;
  }

  try {
    const authService = getServices(req as AuthenticatedRequest).auth;
    const result = await authService.verifyEmail({ email, code, password });

    if (result.token) {
      res.cookie("access_token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: (result.expires_in || 3600) * 1000,
      });
    }

    res.json({
      message: result.message,
      verified: true,
      user: result.user,
      token: result.token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "فشل التحقق من البريد الإلكتروني";
    res.status(400).json({ error: { code: "VERIFICATION_FAILED", message } });
  }
});

// POST /api/auth/resend-verification - Resend OTP code with rate limit cooldown
authRouter.post("/resend-verification", authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";

  if (!email) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "البريد الإلكتروني مطلوب" },
    });
    return;
  }

  try {
    const authService = getServices(req as AuthenticatedRequest).auth;
    const result = await authService.resendVerification({ email });

    res.json({
      message: result.message,
      success: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "تعذر إعادة إرسال الرمز";
    res.status(400).json({ error: { code: "RESEND_FAILED", message } });
  }
});

// DEV-PR.1: POST /api/auth/forgot-password - Request password reset email
authRouter.post("/forgot-password", authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Email is required" } });
    return;
  }

  try {
    const { redirectTo } = req.body;
    const reqOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : undefined);
    const targetRedirect = redirectTo || (reqOrigin ? `${reqOrigin}/` : "https://centrly-platform.vercel.app/");

    const authService = getServices(req as AuthenticatedRequest).auth;
    await authService.forgotPassword(email, targetRedirect);

    res.json({
      message: "If that email is registered, a password recovery link has been sent.",
    });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Password reset request failed" } });
  }
});

// DEV-PR.1: POST /api/auth/reset-password - Complete password reset using user session/token
authRouter.post("/reset-password", authRateLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const token = extractToken(req) || req.body.token;
  // SEC-HOTFIX: Unified contract on 'password' with fallback support for 'new_password'
  const password = req.body.password || req.body.new_password;

  if (!token || !password) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "token and password are required" },
    });
    return;
  }

  try {
    const authService = getServices(req).auth;
    await authService.resetPassword({ token, password });

    res.json({
      message: "Password updated successfully. You can now login with your new password.",
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err as Error & { code?: string }).code === "WEAK_PASSWORD") {
      res.status(400).json({ error: { code: "WEAK_PASSWORD", message: err.message } });
      return;
    }
    const message = err instanceof Error ? err.message : "Password reset failed";
    res.status(400).json({ error: { code: "RESET_FAILED", message } });
  }
});

// DEV-PR.2: POST /api/auth/change-password - Change password for authenticated user
authRouter.post("/change-password", authenticateUser, authRateLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const token = req.token;
  const email = req.user?.email || "";
  const { current_password, new_password, password } = req.body;
  const targetNewPassword = new_password || password;

  if (!targetNewPassword) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "new_password is required" },
    });
    return;
  }

  try {
    const authService = getServices(req).auth;
    await authService.changePassword({
      token: token || "",
      email,
      current_password,
      new_password: targetNewPassword,
    });

    res.json({
      success: true,
      message: "تم تحديث كلمة المرور بنجاح.",
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err as Error & { code?: string }).code === "WEAK_PASSWORD") {
      res.status(400).json({ error: { code: "WEAK_PASSWORD", message: err.message } });
      return;
    }
    const msg = err instanceof Error ? err.message : "Failed to change password";
    if (msg.includes("CURRENT_PASSWORD_INCORRECT") || msg.includes("Invalid login credentials")) {
      res.status(400).json({ error: { code: "CURRENT_PASSWORD_INCORRECT", message: "كلمة المرور الحالية غير صحيحة" } });
      return;
    }
    res.status(400).json({ error: { code: "CHANGE_PASSWORD_FAILED", message: msg } });
  }
});

// POST /api/auth/validate-password - Validates password strength policy
authRouter.post("/validate-password", (req: Request, res: Response): void => {
  const { password } = req.body;
  const authService = getServices(req as AuthenticatedRequest).auth;
  const result = authService.validatePassword(password || "");
  res.json(result);
});

// POST /api/auth/logout - Clear httpOnly access token cookie
authRouter.post("/logout", (_req: Request, res: Response): void => {
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.status(200).json({ message: "Logged out successfully" });
});

// GET /api/auth/me - Return authenticated user profile
authRouter.get("/me", authenticateUser, (req: AuthenticatedRequest, res: Response): void => {
  res.json({ user: req.user });
});

