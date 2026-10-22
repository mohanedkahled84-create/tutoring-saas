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

  // Omar Mohamadi canary
  if (isOmarMohamadiAccount(user)) {
    return true;
  }

  return false;
}

/**
 * Checks if the user is Mr. Omar El-Mohammadi or Admin/Tester
 */
export function isOmarMohamadiAccount(user = null) {
  if (!user && typeof window !== "undefined") {
    user = window.centrlyApp?.user;
  }
  if (!user) return false;
  if (user.role === "admin" || user.is_superadmin) return true;
  const email = (user.email || "").toLowerCase();
  const name = (user.name || user.teacher_name || user.tenant_name || "").toLowerCase();
  const adminEmails = [
    "mohanedkahled84@gmail.com",
    "mohanedkhaled84@gmail.com",
    "mohanedkhaled2367@gmail.com",
    "teacher@centrly.app",
    "mohanedabdulhalim@gmail.com",
  ];
  if (adminEmails.includes(email)) return true;
  if (
    email.includes("omar") ||
    email.includes("mohamadi") ||
    name.includes("عمر") ||
    name.includes("محمدي")
  ) {
    return true;
  }
  if (user.tenant_id === "0c67b644-ae42-49e8-975f-85b9d0af0e1b") return true;
  return false;
}

/**
 * Checks if the student is Mohaned Khaled (Test student)
 */
export function isMohanedKhaledStudent(student = null) {
  if (!student) return false;
  const name = (student.name || "").toLowerCase();
  const phone = String(student.student_phone || student.phone || student.parent_phone || "");
  const code = String(student.student_code || student.code || "");
  if (name.includes("مهند") || name.includes("mohaned")) return true;
  if (phone.includes("01123671177") || phone.includes("1123671177")) return true;
  if (code === "1001" || code.includes("1001")) return true;
  return false;
}
