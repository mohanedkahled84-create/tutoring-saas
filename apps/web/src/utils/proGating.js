/**
 * Centralized PRO tier check for Centrly
 * Evaluates whether the current teacher/user has active PRO capabilities.
 */
export function isUserPro(user = null, plan = null) {
  if (!user && typeof window !== "undefined") {
    user = window.centrlyApp?.user;
  }
  if (!plan && typeof window !== "undefined") {
    plan = window.centrlyApp?.platformBuilderState?.plan || window.centrlyApp?.billingState;
  }

  if (!user) return false;

  // Platform admins always have full access
  if (user.role === "admin" || user.is_superadmin) {
    return true;
  }

  // Explicit flag from platform/settings endpoint
  if (plan && plan.is_pro) {
    return true;
  }

  // Explicit user flags
  if (user.is_pro || user.settings?.is_pro) {
    return true;
  }

  // Tier check (pro, growth, 750, 1500)
  const tier = (
    user.subscription_tier ||
    user.tier ||
    plan?.subscription_tier ||
    ""
  ).toLowerCase();

  if (
    tier === "pro" ||
    tier === "growth" ||
    tier.includes("pro") ||
    tier.includes("750") ||
    tier.includes("1500")
  ) {
    return true;
  }

  return false;
}
