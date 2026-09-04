import { Response, NextFunction } from "express";
import { AuthenticatedRequest, UserRole } from "../types/index.js";
import { supabasePublic, getScopedSupabaseClient } from "../supabase.js";

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
    const { data: authData, error: authError } = await supabasePublic.auth.getUser(token);

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

    // 2. Resolve role & tenant from public.users using token-scoped client
    const userClient = getScopedSupabaseClient(token);
    const { data: userRecord, error: userError } = await userClient
      .from("users")
      .select("id, tenant_id, role, email")
      .eq("id", userId)
      .single();

    if (userError || !userRecord) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "User account exists but has no application profile or is inactive",
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
    req.user = {
      id: userId,
      email: email || userRecord.email,
      tenant_id: userRecord.tenant_id,
      role: userRecord.role as UserRole,
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
export const requireOwnerOrAdmin = requireRole(["admin", "owner"]);

// DEV-SE.5: Financial access guard - assistants must NEVER see teacher profit / revenue data
export function requireFinancialAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role === "assistant") {
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
