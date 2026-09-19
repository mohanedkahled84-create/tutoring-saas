import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { validateBody } from "../../shared/middleware/validation.js";
import { requireCenterOwnerOrAdmin } from "../../shared/middleware/auth.js";
import { getServices } from "../../composition.js";
import { supabasePublic } from "../../supabase.js";
import { defaultEmailVerificationService } from "./emailService.js";
import { financialPinRateLimiter } from "../../shared/middleware/rateLimit.js";

export const settingsRouter = Router();

export function normalizeDigits(str: unknown): string {
  if (!str && str !== 0) return "";
  return String(str)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .trim();
}

export const DEFAULT_TENANT_SETTINGS = {
  homework_submission: "in_session" as const,
  auto_notification: true,
  enable_top_performers: true,
};

const updateSettingsSchema = z.object({
  homework_submission: z.enum(["in_session", "online_before_session"]).optional(),
  auto_notification: z.boolean().optional(),
  enable_top_performers: z.boolean().optional(),
});

// GET /api/settings - Get tenant workflow settings
settingsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(400).json({
      error: {
        code: "TENANT_CONTEXT_REQUIRED",
        message: "No tenant context available for this request.",
      },
    });
    return;
  }

  try {
    const tenantsRepo = getServices(req).tenants;
    const settings = await tenantsRepo.getTenantSettings(tenantId);

    res.json({
      settings: {
        ...DEFAULT_TENANT_SETTINGS,
        ...(settings || {}),
      },
    });
  } catch (_err: unknown) {
    // Return default settings gracefully on failure
    res.json({ settings: DEFAULT_TENANT_SETTINGS });
  }
});

// PUT /api/settings - Update tenant workflow settings
// C-04: Role gate enforced - only owner, center_owner, or admin can modify tenant settings
settingsRouter.put(
  "/",
  requireCenterOwnerOrAdmin,
  validateBody(updateSettingsSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(400).json({
        error: {
          code: "TENANT_CONTEXT_REQUIRED",
          message: "No tenant context available for this request.",
        },
      });
      return;
    }

    try {
      const tenantsRepo = getServices(req).tenants;

      // Fetch existing settings via repository (scoped client)
      const existingSettings = await tenantsRepo.getTenantSettings(tenantId);

      const mergedSettings = {
        ...DEFAULT_TENANT_SETTINGS,
        ...(existingSettings || {}),
        ...req.body,
      };

      const updated = await tenantsRepo.updateTenantSettings(tenantId, mergedSettings);

      res.json({
        message: "Settings updated successfully",
        settings: updated || mergedSettings,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update tenant settings";
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to update tenant settings", details: message },
      });
    }
  }
);

interface PinResetOtpRecord {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
}
export const pinResetOtpStore = new Map<string, PinResetOtpRecord>();

const setPinSchema = z.object({
  pin: z
    .string()
    .transform((val) => normalizeDigits(val))
    .pipe(z.string().regex(/^\d{4,6}$/, "يجب أن يتكون رمز الأمان من 4 إلى 6 أرقام فقط")),
  old_pin: z.string().optional().nullable(),
  email_code: z.string().optional().nullable(),
});

const verifyPinSchema = z.object({
  pin: z.string().min(1, "رمز الأمان مطلوب"),
});

const requestResetSchema = z.object({}).optional().default({});

// POST /api/settings/security-pin/request-reset - Send OTP to user's registered email to reset financial PIN
settingsRouter.post(
  "/security-pin/request-reset",
  validateBody(requestResetSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id;
    let userEmail = (req.user?.email || "").trim().toLowerCase();

    if (!userId && !tenantId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    try {
      // If userEmail is not on req.user, look it up in users table
      if (!userEmail && userId) {
        const { data: userRec } = await supabasePublic
          .from("users")
          .select("email, full_name")
          .eq("id", userId)
          .maybeSingle();
        if (userRec?.email) {
          userEmail = userRec.email.trim().toLowerCase();
        }
      }

      if (!userEmail) {
        res.status(400).json({
          error: {
            code: "NO_EMAIL_ON_ACCOUNT",
            message: "لا يوجد بريد إلكتروني مسجل لهذا الحساب لإرسال كود التحقق إليه. يرجى التواصل مع الدعم الفني.",
          },
        });
        return;
      }

      // Check cooldown (60 seconds between OTP requests)
      const existingOtp = pinResetOtpStore.get(userEmail);
      if (existingOtp && Date.now() < existingOtp.expiresAt) {
        const elapsedMs = 15 * 60 * 1000 - (existingOtp.expiresAt - Date.now());
        if (elapsedMs < 60 * 1000) {
          const waitSeconds = Math.ceil((60 * 1000 - elapsedMs) / 1000);
          res.status(429).json({
            error: {
              code: "RATE_LIMITED",
              message: `يرجى الانتظار ${waitSeconds} ثانية قبل طلب كود تحقق جديد.`,
            },
          });
          return;
        }
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000;

      pinResetOtpStore.set(userEmail, { code, email: userEmail, expiresAt, attempts: 0 });
      if (userId) {
        pinResetOtpStore.set(userId, { code, email: userEmail, expiresAt, attempts: 0 });
      }

      // Record in Supabase email_verifications table
      try {
        await supabasePublic.from("email_verifications").insert({
          email: userEmail,
          code,
          expires_at: new Date(expiresAt).toISOString(),
          attempts: 0,
        });
      } catch (_) {}

      // Send email via defaultEmailVerificationService (Resend)
      let sentViaResend = false;
      try {
        const resendResult = await defaultEmailVerificationService.sendPinResetEmail({
          email: userEmail,
          code,
          fullName: (req.user as any)?.full_name || (req.user as any)?.name || (req.user as any)?.tenant_name,
        });
        if (resendResult?.success) {
          sentViaResend = true;
        }
      } catch (_) {}

      // If Resend was not configured or skipped, also send via Supabase Auth signInWithOtp
      if (!sentViaResend) {
        try {
          await supabasePublic.auth.signInWithOtp({
            email: userEmail,
            options: { shouldCreateUser: false },
          });
        } catch (_) {}
      }

      // Mask email for security display (e.g. mo***84@gmail.com)
      const atIndex = userEmail.indexOf("@");
      let maskedEmail = userEmail;
      if (atIndex > 2) {
        const prefix = userEmail.substring(0, 2);
        const suffix = userEmail.substring(atIndex - 1);
        maskedEmail = `${prefix}***${suffix}`;
      }

      res.json({
        success: true,
        email: maskedEmail,
        message: `تم إرسال كود التحقق (6 أرقام) إلى بريدك الإلكتروني (${maskedEmail}) بنجاح. صالح لمدة 15 دقيقة.`,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);

// GET /api/settings/security-pin - Check if user account or tenant has configured financial security PIN
settingsRouter.get("/security-pin", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const tenantId = req.user?.tenant_id;
  if (!userId && !tenantId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    return;
  }

  try {
    if (req.user?.financial_pin) {
      res.json({ has_pin: true });
      return;
    }

    const tenantsRepo = getServices(req).tenants;

    if (userId && typeof tenantsRepo.getUserPin === "function") {
      const userPin = await tenantsRepo.getUserPin(userId).catch(() => null);
      if (userPin) {
        if (req.user) {
          req.user.financial_pin = normalizeDigits(userPin);
          req.user.has_security_pin = true;
        }
        res.json({ has_pin: true });
        return;
      }
    }

    if (tenantId) {
      const settings = await tenantsRepo.getTenantSettings(tenantId).catch(() => null);
      if (settings?.financial_pin) {
        if (req.user) {
          req.user.financial_pin = normalizeDigits(settings.financial_pin);
          req.user.has_security_pin = true;
        }
        res.json({ has_pin: true });
        return;
      }
    }

    res.json({ has_pin: false });
  } catch {
    res.json({ has_pin: false });
  }
});

// POST /api/settings/security-pin - Set or update financial security PIN
settingsRouter.post(
  "/security-pin",
  validateBody(setPinSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id;
    if (!userId && !tenantId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    try {
      const tenantsRepo = getServices(req).tenants;

      let existingPin: string | null = req.user?.financial_pin ? normalizeDigits(req.user.financial_pin) : null;
      if (!existingPin && userId && typeof tenantsRepo.getUserPin === "function") {
        const uPin = await tenantsRepo.getUserPin(userId).catch(() => null);
        if (uPin) existingPin = normalizeDigits(uPin);
      }
      let existingSettings: any = null;
      if (tenantId) {
        existingSettings = await tenantsRepo.getTenantSettings(tenantId).catch(() => null);
        if (!existingPin && existingSettings?.financial_pin) {
          existingPin = normalizeDigits(existingSettings.financial_pin);
        }
      }

      // If user/tenant already has a PIN, require verification of identity (EITHER Old PIN OR Email OTP - NEVER account password!)
      if (existingPin) {
        const inputOldPin = req.body.old_pin ? normalizeDigits(req.body.old_pin) : "";
        const inputEmailCode = req.body.email_code ? normalizeDigits(req.body.email_code) : "";

        let isVerified = false;

        // 1. Direct match with current/old PIN
        if (inputOldPin && existingPin === inputOldPin) {
          isVerified = true;
        }

        // 2. Verification via Email OTP code
        if (!isVerified && inputEmailCode) {
          const userEmail = (req.user?.email || "").trim().toLowerCase();
          const userKey = userEmail || userId || "";

          // Check in-memory store
          const memRec = pinResetOtpStore.get(userKey) || (userId ? pinResetOtpStore.get(userId) : null) || (userEmail ? pinResetOtpStore.get(userEmail) : null);
          if (memRec && Date.now() < memRec.expiresAt) {
            if (memRec.code === inputEmailCode) {
              isVerified = true;
              pinResetOtpStore.delete(userKey);
              if (userId) pinResetOtpStore.delete(userId);
              if (userEmail) pinResetOtpStore.delete(userEmail);
            } else {
              memRec.attempts = (memRec.attempts || 0) + 1;
            }
          }

          // Check email_verifications table in Supabase
          if (!isVerified && userEmail) {
            try {
              const { data: dbRec } = await supabasePublic
                .from("email_verifications")
                .select("*")
                .eq("email", userEmail)
                .eq("code", inputEmailCode)
                .gt("expires_at", new Date().toISOString())
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (dbRec) {
                isVerified = true;
                await supabasePublic
                  .from("email_verifications")
                  .update({ verified_at: new Date().toISOString() })
                  .eq("id", dbRec.id);
              }
            } catch (_) {}
          }

          // Check Supabase Auth verifyOtp
          if (!isVerified && userEmail) {
            try {
              const { data: verifyData, error: verifyErr } = await supabasePublic.auth.verifyOtp({
                email: userEmail,
                token: inputEmailCode,
                type: "email",
              });
              if (!verifyErr && verifyData?.user) {
                isVerified = true;
              }
            } catch (_) {}
          }
        }

        if (!isVerified) {
          res.status(400).json({
            error: {
              code: "INVALID_CREDENTIALS",
              message: "الرمز القديم أو كود التحقق من الإيميل غير صحيح. يرجى إدخال الرمز القديم أو طلب كود تحقق جديد إلى بريدك الإلكتروني.",
            },
          });
          return;
        }
      }

      const newPin = normalizeDigits(req.body.pin);

      // 1. Persist directly to user account in repository
      if (userId && typeof tenantsRepo.setUserPin === "function") {
        await tenantsRepo.setUserPin(userId, newPin);
      }

      // 2. Also persist to tenant settings for backward compatibility
      if (tenantId) {
        const mergedSettings = {
          ...DEFAULT_TENANT_SETTINGS,
          ...(existingSettings || {}),
          financial_pin: newPin,
        };
        await tenantsRepo.updateTenantSettings(tenantId, mergedSettings as any).catch(() => null);
      }

      if (req.user) {
        req.user.financial_pin = newPin;
        req.user.has_security_pin = true;
      }

      res.json({ success: true, message: "تم تعيين وتأمين الرقم السري بنجاح وربطه بحسابك سحابياً عبر كافة الأجهزة" });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);

// POST /api/settings/verify-pin - Verify financial security PIN
settingsRouter.post(
  "/verify-pin",
  financialPinRateLimiter,
  validateBody(verifyPinSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id;
    if (!userId && !tenantId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    try {
      const tenantsRepo = getServices(req).tenants;
      let userPin: string | null = req.user?.financial_pin ? normalizeDigits(req.user.financial_pin) : null;

      if (!userPin && userId && typeof tenantsRepo.getUserPin === "function") {
        const uPin = await tenantsRepo.getUserPin(userId).catch(() => null);
        if (uPin) userPin = normalizeDigits(uPin);
      }

      let tenantPin: string | null = null;
      if (tenantId) {
        const existingSettings = await tenantsRepo.getTenantSettings(tenantId).catch(() => null);
        if ((existingSettings as any)?.financial_pin) {
          tenantPin = normalizeDigits((existingSettings as any).financial_pin);
        }
      }

      const rawInput = (req.body.pin || "").trim();
      const cleanInputDigits = normalizeDigits(rawInput);

      // Verify strictly against user's PIN or tenant's PIN - NEVER accept account password!
      const isValid = Boolean(
        (userPin && cleanInputDigits && userPin === cleanInputDigits) ||
        (tenantPin && cleanInputDigits && tenantPin === cleanInputDigits)
      );

      // Auto-unify user's PIN in database if validated
      if (isValid && userId && typeof tenantsRepo.setUserPin === "function") {
        const syncPin = tenantPin || (cleanInputDigits.length >= 4 && cleanInputDigits.length <= 6 ? cleanInputDigits : null);
        if (syncPin && userPin !== syncPin) {
          await tenantsRepo.setUserPin(userId, syncPin).catch(() => null);
          if (req.user) {
            req.user.financial_pin = syncPin;
            req.user.has_security_pin = true;
          }
        }
      }

      res.json({ valid: isValid });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);

const deletePinSchema = z
  .object({
    old_pin: z.string().optional().nullable(),
    email_code: z.string().optional().nullable(),
    pin: z.string().optional().nullable(),
  })
  .optional()
  .default({ old_pin: undefined, email_code: undefined, pin: undefined });

// DELETE /api/settings/security-pin - Remove financial security PIN
settingsRouter.delete(
  "/security-pin",
  validateBody(deletePinSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id;
    if (!userId && !tenantId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    try {
      const tenantsRepo = getServices(req).tenants;

      let savedPin: string | null = req.user?.financial_pin ? normalizeDigits(req.user.financial_pin) : null;
      if (!savedPin && userId && typeof tenantsRepo.getUserPin === "function") {
        const uPin = await tenantsRepo.getUserPin(userId).catch(() => null);
        if (uPin) savedPin = normalizeDigits(uPin);
      }
      let existingSettings: any = null;
      if (!savedPin && tenantId) {
        existingSettings = await tenantsRepo.getTenantSettings(tenantId).catch(() => null);
        if ((existingSettings as any)?.financial_pin) {
          savedPin = normalizeDigits((existingSettings as any).financial_pin);
        }
      }

      // If a PIN exists, require verification of identity (old PIN or email code) before deleting
      if (savedPin) {
        const inputOldPin = req.body?.old_pin || req.body?.pin ? normalizeDigits(req.body?.old_pin || req.body?.pin) : "";
        const inputEmailCode = req.body?.email_code ? normalizeDigits(req.body?.email_code) : "";

        let isVerified = false;
        if (inputOldPin && savedPin === inputOldPin) {
          isVerified = true;
        }

        if (!isVerified && inputEmailCode) {
          const userEmail = (req.user?.email || "").trim().toLowerCase();
          const userKey = userEmail || userId || "";
          const memRec = pinResetOtpStore.get(userKey) || (userId ? pinResetOtpStore.get(userId) : null) || (userEmail ? pinResetOtpStore.get(userEmail) : null);
          if (memRec && Date.now() < memRec.expiresAt && memRec.code === inputEmailCode) {
            isVerified = true;
            pinResetOtpStore.delete(userKey);
          }
        }

        if (!isVerified) {
          res.status(400).json({
            error: {
              code: "INVALID_CREDENTIALS",
              message: "يجب إدخال الرمز القديم الصحيح أو كود التحقق من الإيميل لتأكيد هويتك قبل حذف الرمز.",
            },
          });
          return;
        }
      }

      if (userId && typeof tenantsRepo.setUserPin === "function") {
        await tenantsRepo.setUserPin(userId, null);
      }

      if (tenantId) {
        if (!existingSettings) {
          existingSettings = await tenantsRepo.getTenantSettings(tenantId).catch(() => null);
        }
        const mergedSettings = { ...existingSettings };
        delete (mergedSettings as any).financial_pin;
        await tenantsRepo.updateTenantSettings(tenantId, mergedSettings as any).catch(() => null);
      }

      if (req.user) {
        req.user.financial_pin = null;
        req.user.has_security_pin = false;
      }

      res.json({ success: true, message: "تم إزالة الرقم السري بنجاح" });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);
