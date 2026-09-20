import { Response, NextFunction } from "express";
import { AuthenticatedRequest, UserRole } from "../types/index.js";
import { supabasePublic, getScopedSupabaseClient } from "../../supabase.js";

// Helper to extract token from Authorization header or httpOnly cookie
export function extractToken(req: AuthenticatedRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  // httpOnly cookie fallback (mitigates XSS token theft)
  if (req.cookies && (req.cookies.access_token || req.cookies["sb-access-token"])) {
    return req.cookies.access_token || req.cookies["sb-access-token"];
  }

  return null;
}

// Exported client resolver to allow deterministic testing and mocking
export const authClientResolver = {
  supabasePublic,
  getScopedSupabaseClient,
};

// DEV-AUTH.1: Authenticate token and resolve tenant context
export async function authenticateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message:
          "Missing or invalid authentication token (expected Bearer header or httpOnly cookie)",
      },
    });
    return;
  }

  try {
    // 1. Verify token with Supabase Auth
    const { data: authData, error: authError } = await authClientResolver.supabasePublic.auth.getUser(token);

    if (authError || !authData.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired session token",
          details: authError?.message,
        },
      });
      return;
    }

    const userId = authData.user.id;
    const email = authData.user.email;

    // 2. Resolve role & tenant from public.users
    const userClient = authClientResolver.getScopedSupabaseClient(token);
    let userRecord: any = null;
    let lastDbError: any = null;
    let userRowNotFound = false;

    // Fast, rock-solid resolution via SECURITY DEFINER RPC
    try {
      const { data: rpcProfile, error: rpcError } = await authClientResolver.supabasePublic.rpc("get_user_profile", {
        p_user_id: userId,
      });
      if (!rpcError) {
        if (rpcProfile) {
          userRecord = rpcProfile;
        } else {
          userRowNotFound = true;
        }
      } else {
        lastDbError = rpcError;
      }
    } catch (err) {
      lastDbError = err;
    }

    // Fallback: direct query via token-scoped client if not resolved yet
    if (!userRecord && !userRowNotFound) {
      const { data: directProfile, error: userError } = await userClient
        .from("users")
        .select("id, tenant_id, role, email, teacher_id, assistant_id, full_name, financial_pin_hash")
        .eq("id", userId)
        .single();

      if (userError) {
        if (userError.code === "PGRST116" || (userError.message && userError.message.includes("0 rows"))) {
          userRowNotFound = true;
        } else {
          lastDbError = userError;
          console.error(`[auth.middleware] Database error resolving user profile for ${userId}:`, userError);
        }
      } else if (directProfile) {
        userRecord = directProfile;
        userRowNotFound = false;
        lastDbError = null;
      }
    }

    if (!userRecord) {
      if (userRowNotFound) {
        res.status(403).json({
          error: {
            code: "NO_PROFILE",
            message: "لا يوجد ملف مستخدم مرتبط بهذا الحساب أو الحساب غير مفعل",
          },
        });
        return;
      }

      // Any other DB / PostgREST error -> 503 AUTH_BACKEND_ERROR
      console.error(`[auth.middleware] Backend DB error resolving profile for ${userId}:`, lastDbError);
      res.status(503).json({
        error: {
          code: "AUTH_BACKEND_ERROR",
          message: "تعذر التحقق من بيانات الحساب مؤقتاً بسبب خطأ في الخادم. يرجى المحاولة بعد قليل.",
        },
      });
      return;
    }

    if (!userRecord.tenant_id && userRecord.role !== "admin") {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "User is not assigned to an active tenant organization",
        },
      });
      return;
    }

    // 3. Attach user context and scoped client
    const fullName = (userRecord as { full_name?: string | null })?.full_name || authData.user.user_metadata?.full_name || null;
    const hasSecurityPin = Boolean((userRecord as { financial_pin_hash?: string | null })?.financial_pin_hash);

    req.user = {
      id: userId,
      email: email || userRecord.email,
      name: fullName,
      full_name: fullName,
      tenant_id: userRecord.tenant_id,
      role: userRecord.role as UserRole,
      teacher_id: userRecord.teacher_id,
      assistant_id: userRecord.assistant_id,
      has_security_pin: hasSecurityPin,
    };
    req.token = token;
    req.supabase = userClient;

    next();
  } catch (err: unknown) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Authentication verification failed",
        details: (err as Error).message,
      },
    });
  }
}

// DEV-AUTH.2 & DEV-SE.5: Role check on endpoints
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: `Access denied: role '${req.user.role}' is not authorized for this resource`,
          requiredRoles: allowedRoles,
        },
      });
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole(["admin"]);
export const requireOwnerOrAdmin = requireRole(["admin", "owner", "center_owner"]);
export const requireCenterOwnerOrAdmin = requireRole(["admin", "owner", "center_owner"]);
export const requireTeacherOrCenterOwner = requireRole([
  "admin",
  "owner",
  "center_owner",
  "teacher",
]);

// DEV-SE.5 & DEV-72: Financial access guard - assistants must NEVER see teacher/center profit data
export function requireFinancialAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const restrictedRoles: UserRole[] = ["assistant", "assistant_to_teacher", "assistant_to_center"];
  if (!req.user || restrictedRoles.includes(req.user.role)) {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message:
          "Access denied: financial records and revenue aggregates are restricted from assistant role",
      },
    });
    return;
  }
  next();
}

// DEV-AUTH.3: Password strength validation rule
export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 8) {
    return { valid: false, reason: "Password must be at least 8 characters long" };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { valid: false, reason: "Password must contain at least one letter" };
  }
  if (!/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return {
      valid: false,
      reason: "Password must contain at least one digit or special character",
    };
  }
  return { valid: true };
}
