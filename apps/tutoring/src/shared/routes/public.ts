import { Router, Response, Request } from "express";
import { validateBody, publicSelfRegisterSchema } from "../middleware/validation.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { verifyParentPortalToken, generateParentPortalToken } from "../utils/tokens.js";
import { getServices } from "../../composition.js";
import { AuthenticatedRequest } from "../types/index.js";
import { authRateLimiter } from "../middleware/rateLimit.js";
import { normalizeMaterialUrl } from "../../features/materials/routes.js";

export const publicRouter = Router();

// POST /api/public/register - Student Self-Registration from shareable link
publicRouter.post(
  "/register",
  validateBody(publicSelfRegisterSchema),
  async (req: Request, res: Response): Promise<void> => {
    const supabase = getServiceSupabaseClient();
    const { tenant_id, name, parent_phone, student_phone, group_id } = req.body;

    try {
      // 1. Insert student
      const { data: student, error: studentError } = await supabase
        .from("students")
        .insert({
          tenant_id,
          name,
          parent_phone,
          student_phone,
        })
        .select()
        .single();

      if (studentError) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: studentError.message } });
        return;
      }

      // 2. Enroll student into group
      await supabase.from("group_students").insert({
        tenant_id,
        student_id: student.id,
        group_id,
      });

      res.status(201).json({
        message: "تم تسجيل بيانات الطالب بنجاح",
        student,
        verification_message_queued: true,
      });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to self-register" } });
    }
  }
);

// DEV-34 & DEV-PORTAL: GET /api/public/parent-portal - Lightweight No-App Student Portal with Live Quizzes & Attendance
publicRouter.get("/parent-portal", async (req: Request, res: Response): Promise<void> => {
  const token = (req.query.token as string) || "";
  if (!token) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Token is required" } });
    return;
  }

  const supabase = getServiceSupabaseClient();
  const verified = verifyParentPortalToken(token);

  const studentId = verified?.student_id || null;
  const tenantId = verified?.tenant_id || null;

  try {
    const { data: portalData, error: rpcError } = await supabase.rpc("get_parent_portal_payload", {
      p_token: token,
      p_student_id: studentId,
      p_tenant_id: tenantId,
    });

    if (rpcError || !portalData) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "رابط المتابعة غير صالح أو منتهي الصلاحية. يرجى التواصل مع إدارة السنتر." },
      });
      return;
    }

    if (portalData && Array.isArray(portalData.materials)) {
      portalData.materials = portalData.materials.map((m: any) => ({
        ...m,
        url: normalizeMaterialUrl(m.url),
        submission_url: normalizeMaterialUrl(m.submission_url),
      }));
    }

    res.json(portalData);
  } catch (err: unknown) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "حدث خطأ أثناء تحميل بيانات المتابعة" },
    });
  }
});

// GET /api/public/short-links/:code - Resolve short code to portal token
publicRouter.get("/short-links/:code", async (req: Request, res: Response): Promise<void> => {
  const code = (req.params.code || "").trim();
  if (!code) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Code is required" } });
    return;
  }

  const supabase = getServiceSupabaseClient();

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("resolve_portal_short_code", { p_code: code });
    if (!rpcError && rpcData) {
      const resolved = typeof rpcData === "string" ? JSON.parse(rpcData) : rpcData;
      let token = resolved.token;
      if (!token && resolved.student_id && resolved.tenant_id) {
        token = generateParentPortalToken(resolved.student_id, resolved.tenant_id, 365);
        try {
          await supabase.from("short_links").upsert(
            {
              code: resolved.code || code,
              tenant_id: resolved.tenant_id,
              student_id: resolved.student_id,
              portal_type: resolved.portal_type || "parent",
              token,
            },
            { onConflict: "code" }
          );
        } catch (_) {}
      }

      if (token) {
        res.json({
          code: resolved.code || code,
          token,
          portal_type: resolved.portal_type || "parent",
          student_id: resolved.student_id,
          student_name: resolved.student_name,
        });
        return;
      }
    }
  } catch (err) {
    console.warn("resolve_portal_short_code RPC error:", err);
  }

  // Fallback direct short_links query
  try {
    const { data, error } = await supabase
      .from("short_links")
      .select("code, token, portal_type, student_id")
      .eq("code", code)
      .maybeSingle();

    if (!error && data && data.token) {
      res.json({
        code: data.code,
        token: data.token,
        portal_type: data.portal_type || "parent",
        student_id: data.student_id,
      });
      return;
    }
  } catch (_) {}

  // Fallback direct student lookup by deterministic UUID prefix
  try {
    const isStudent = code.toLowerCase().startsWith("s");
    const portalType = isStudent ? "student" : "parent";
    const rawHex = code.toLowerCase().replace(/^[ps]+/, "");
    if (/^[0-9a-f]{4,8}$/i.test(rawHex)) {
      const lowerBound = `${rawHex.padEnd(8, "0")}-0000-0000-0000-000000000000`;
      const upperBound = `${rawHex.padEnd(8, "f")}-ffff-ffff-ffff-ffffffffffff`;
      const { data: matchedStudents } = await supabase
        .from("students")
        .select("id, tenant_id, name, parent_portal_token")
        .gte("id", lowerBound)
        .lte("id", upperBound)
        .limit(1);

      if (matchedStudents && matchedStudents.length > 0) {
        const student = matchedStudents[0];
        const token = student.parent_portal_token || generateParentPortalToken(student.id, student.tenant_id, 365);
        res.json({
          code,
          token,
          portal_type: portalType,
          student_id: student.id,
          student_name: student.name,
        });
        return;
      }
    }
  } catch (err) {
    console.warn("Deterministic short link fallback resolution error:", err);
  }

  res.status(404).json({
    error: { code: "NOT_FOUND", message: "رابط المتابعة غير صحيح أو غير موجود" },
  });
});

// GET /api/public/p/:code - Direct 302 Redirect for Parent Portal
publicRouter.get("/p/:code", async (req: Request, res: Response): Promise<void> => {
  const code = (req.params.code || "").trim();
  const canonicalOrigin = process.env.PUBLIC_APP_URL || "https://centerly-eg.com";
  res.redirect(`${canonicalOrigin}/p/${code}`);
});

// GET /api/public/s/:code - Direct 302 Redirect for Student Portal
publicRouter.get("/s/:code", async (req: Request, res: Response): Promise<void> => {
  const code = (req.params.code || "").trim();
  const canonicalOrigin = process.env.PUBLIC_APP_URL || "https://centerly-eg.com";
  res.redirect(`${canonicalOrigin}/s/${code}`);
});

// DEV-PORTAL: POST /api/public/portal/login - Authenticate student/parent from /portal
publicRouter.post("/portal/login", authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const identifier = typeof req.body.identifier === "string" ? req.body.identifier.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password.trim() : "";
  const role = req.body.role === "student" || req.body.role === "parent" ? req.body.role : undefined;

  if (!identifier || !password) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "يرجى إدخال رقم الهاتف أو كود الطالب وكلمة المرور" },
    });
    return;
  }

  try {
    const studentsService = getServices(req as AuthenticatedRequest).students;
    const result = await studentsService.authenticatePortalUser({ identifier, password, role });
    res.json(result);
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === "INVALID_CREDENTIALS") {
        res.status(401).json({
          error: { code: "INVALID_CREDENTIALS", message: "رقم الهاتف أو كلمة المرور غير صحيحة" },
        });
        return;
      }
      if (err.message === "MISSING_CREDENTIALS") {
        res.status(400).json({
          error: { code: "BAD_REQUEST", message: "يرجى كتابة رقم الهاتف وكلمة المرور" },
        });
        return;
      }
    }
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: msg } });
  }
});

// DEV-PORTAL: POST /api/public/portal/change-password - Change portal password
publicRouter.post("/portal/change-password", async (req: Request, res: Response): Promise<void> => {
  const studentId = typeof req.body.student_id === "string" ? req.body.student_id.trim() : "";
  const oldPassword = typeof req.body.old_password === "string" ? req.body.old_password.trim() : "";
  const newPassword = typeof req.body.new_password === "string" ? req.body.new_password.trim() : "";

  if (!studentId || !newPassword) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "بيانات تغيير كلمة المرور غير مكتملة" },
    });
    return;
  }

  try {
    const studentsService = getServices(req as AuthenticatedRequest).students;
    await studentsService.changePortalPassword(studentId, oldPassword, newPassword);
    res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === "INVALID_OLD_PASSWORD") {
        res.status(401).json({
          error: { code: "INVALID_OLD_PASSWORD", message: "كلمة المرور الحالية غير صحيحة" },
        });
        return;
      }
      if (err.message === "PASSWORD_TOO_SHORT") {
        res.status(400).json({
          error: { code: "PASSWORD_TOO_SHORT", message: "كلمة المرور يجب ألا تقل عن 4 خانات" },
        });
        return;
      }
      if (err.message === "STUDENT_NOT_FOUND") {
        res.status(404).json({
          error: { code: "NOT_FOUND", message: "الطالب غير موجود" },
        });
        return;
      }
    }
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: msg } });
  }
});



