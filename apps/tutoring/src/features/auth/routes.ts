import { Router, Request, Response } from "express";
import { getServices } from "../../composition.js";
import { extractToken } from "../../shared/middleware/auth.js";
import { AuthenticatedRequest } from "../../shared/types/index.js";

export const authRouter = Router();

// POST /api/auth/login - Rate-limited, brute-force protected login
authRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Email and password are required" } });
    return;
  }

  try {
    const authService = getServices(req as AuthenticatedRequest).auth;
    const result = await authService.login({ email, password });

    res.cookie("access_token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: result.expires_in * 1000,
    });

    res.json({
      message: "Login successful",
      user: result.user,
      token: result.token,
      expires_in: result.expires_in,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      if ((err as Error & { code?: string }).code === "ACCOUNT_LOCKED") {
        res.status(429).json({ error: { code: "ACCOUNT_LOCKED", message: err.message } });
        return;
      }
      if (err.message === "INVALID_CREDENTIALS") {
        res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
        return;
      }
    }
    const message = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// DEV-SA.1 & DEV-SL.1: POST /api/auth/signup - Teacher registration with 14-day trial & founder alert
authRouter.post("/signup", async (req: Request, res: Response): Promise<void> => {
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
      }
    );

    res.status(201).json({
      message: "Signup successful. Your 14-day free trial is active.",
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

// DEV-PR.1: POST /api/auth/forgot-password - Request password reset email
authRouter.post("/forgot-password", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Email is required" } });
    return;
  }

  try {
    const authService = getServices(req as AuthenticatedRequest).auth;
    await authService.forgotPassword(email);

    res.json({
      message: "If that email is registered, a password recovery link has been sent.",
    });
  } catch (err: unknown) {
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

// POST /api/auth/validate-password - Validates password strength policy
authRouter.post("/validate-password", (req: Request, res: Response): void => {
  const { password } = req.body;
  const authService = getServices(req as AuthenticatedRequest).auth;
  const result = authService.validatePassword(password || "");
  res.json(result);
});
