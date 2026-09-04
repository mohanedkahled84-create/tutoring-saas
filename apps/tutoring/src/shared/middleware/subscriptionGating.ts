import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types/index.js";

// DEV-SL.2: Subscription Access Gating Middleware
// Checks tenant subscription lifecycle. Read operations are allowed during grace period;
// write operations or fully expired tenants are blocked with clear renewal messaging.
export async function requireActiveSubscription(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Admin role is exempt from subscription gating
  if (req.user?.role === "admin") {
    next();
    return;
  }

  const supabase = req.supabase!;
  const tenantId = req.user?.tenant_id;

  if (!tenantId) {
    res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "No active tenant organization context" } });
    return;
  }

  try {
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("id, name, subscription_status, trial_ends_at, subscription_ends_at, deleted_at")
      .eq("id", tenantId)
      .single();

    if (error || !tenant) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Tenant profile not found" } });
      return;
    }

    if (tenant.deleted_at) {
      res.status(403).json({
        error: {
          code: "ACCOUNT_DEACTIVATED",
          message: "This account has been deactivated. Please contact support.",
        },
      });
      return;
    }

    const now = new Date();
    const GRACE_PERIOD_DAYS = 7;
    const isWriteOperation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

    // 1. Deactivated status
    if (tenant.subscription_status === "deactivated") {
      res.status(403).json({
        error: {
          code: "ACCOUNT_DEACTIVATED",
          message: "Subscription is deactivated. Please renew payment to reactivate your account.",
        },
      });
      return;
    }

    // 2. Trial status evaluation
    if (tenant.subscription_status === "trial") {
      const trialEnds = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
      if (trialEnds && now > trialEnds) {
        const graceEnds = new Date(trialEnds.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
        if (now > graceEnds || isWriteOperation) {
          res.status(402).json({
            error: {
              code: "TRIAL_EXPIRED",
              message:
                "Your 14-day free trial has expired. Please submit payment proof to activate your subscription.",
              trial_ended_at: trialEnds.toISOString(),
              in_grace_period: now <= graceEnds,
            },
          });
          return;
        }
      }
    }

    // 3. Past due status evaluation
    if (tenant.subscription_status === "past_due") {
      const subEnds = tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at) : null;
      if (subEnds) {
        const graceEnds = new Date(subEnds.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
        if (now > graceEnds || isWriteOperation) {
          res.status(402).json({
            error: {
              code: "SUBSCRIPTION_EXPIRED",
              message:
                "Your subscription renewal is past due. Please submit payment proof to continue.",
              subscription_ended_at: subEnds.toISOString(),
            },
          });
          return;
        }
      }
    }

    // 4. Active or pending_verification or valid trial
    next();
  } catch (err: unknown) {
    res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Failed to verify subscription status" } });
  }
}
