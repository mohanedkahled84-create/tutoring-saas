import { Router, Response, Request } from "express";
import { validateBody, publicSelfRegisterSchema } from "../middleware/validation.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { verifyParentPortalToken, generateParentPortalToken } from "../utils/tokens.js";

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

  // 1. Direct query from short_links table
  try {
    const { data, error } = await supabase
      .from("short_links")
      .select("code, token, portal_type, student_id, tenant_id")
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
  } catch (err) {
    console.warn("short_links lookup error:", err);
  }

  // 2. Fallback: match by student UUID prefix
  const isStudentPortal = code.toLowerCase().startsWith("s");
  const portalType = isStudentPortal ? "student" : "parent";
  const hexPrefix = code.replace(/^[ps]/i, "").toLowerCase();

  if (hexPrefix.length >= 6) {
    try {
      const { data: students, error: studError } = await supabase
        .from("students")
        .select("id, tenant_id, name")
        .ilike("id", `${hexPrefix}%`)
        .limit(2);

      if (!studError && students && students.length === 1) {
        const student = students[0];
        const token = generateParentPortalToken(student.id, student.tenant_id, 365);

        // Cache into short_links table
        try {
          await supabase.from("short_links").upsert(
            {
              code,
              tenant_id: student.tenant_id,
              student_id: student.id,
              portal_type: portalType,
              token,
            },
            { onConflict: "code" }
          );
        } catch (_) {}

        res.json({
          code,
          token,
          portal_type: portalType,
          student_id: student.id,
          student_name: student.name,
        });
        return;
      }
    } catch (err) {
      console.warn("Fallback student lookup error:", err);
    }
  }

  res.status(404).json({
    error: { code: "NOT_FOUND", message: "رابط المتابعة غير صحيح أو غير موجود" },
  });
});

// GET /api/public/p/:code - Direct 302 Redirect for Parent Portal
publicRouter.get("/p/:code", async (req: Request, res: Response): Promise<void> => {
  const code = (req.params.code || "").trim();
  const canonicalOrigin = "https://centerly-platform.vercel.app";
  res.redirect(`${canonicalOrigin}/p/${code}`);
});

// GET /api/public/s/:code - Direct 302 Redirect for Student Portal
publicRouter.get("/s/:code", async (req: Request, res: Response): Promise<void> => {
  const code = (req.params.code || "").trim();
  const canonicalOrigin = "https://centerly-platform.vercel.app";
  res.redirect(`${canonicalOrigin}/s/${code}`);
});


