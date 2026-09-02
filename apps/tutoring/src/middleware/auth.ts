import { Response, NextFunction } from "express";
import { AuthenticatedRequest, UserContext } from "../types/index.js";
import { supabasePublic, getScopedSupabaseClient } from "../supabase.js";

export async function authenticateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    // 1. Verify token with Supabase Auth
    const { data: authData, error: authError } = await supabasePublic.auth.getUser(token);

    if (authError || !authData.user) {
      res.status(401).json({ error: "Invalid or expired token", details: authError?.message });
      return;
    }

    const userId = authData.user.id;
    const email = authData.user.email;

    // 2. Resolve tenant context from public.users using the user-scoped client
    const userClient = getScopedSupabaseClient(token);
    const { data: userRecord, error: userError } = await userClient
      .from("users")
      .select("id, tenant_id, role, email")
      .eq("id", userId)
      .single();

    if (userError || !userRecord) {
      res.status(403).json({ error: "User profile not found or unauthorized", details: userError?.message });
      return;
    }

    if (!userRecord.tenant_id && userRecord.role !== "admin") {
      res.status(403).json({ error: "User is not associated with an active tenant" });
      return;
    }

    // 3. Attach tenant context and scoped Supabase client to request
    req.user = {
      id: userId,
      email: email || userRecord.email,
      tenant_id: userRecord.tenant_id,
      role: userRecord.role as "admin" | "owner",
    };
    req.token = token;
    req.supabase = userClient;

    next();
  } catch (err: any) {
    res.status(500).json({ error: "Internal authentication error", message: err.message });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  next();
}
