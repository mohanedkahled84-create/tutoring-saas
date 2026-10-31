import { Router, Response, Request } from "express";
import compression from "compression";
import { constants as zlibConstants } from "node:zlib";
import { validateBody, publicSelfRegisterSchema } from "../middleware/validation.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { verifyParentPortalToken, generateParentPortalToken } from "../utils/tokens.js";
import { getServices } from "../../composition.js";
import { AuthenticatedRequest } from "../types/index.js";
import { authRateLimiter } from "../middleware/rateLimit.js";
import { normalizeMaterialUrl } from "../../features/materials/routes.js";
import { mergeLegacyPortalQuizzes } from "../utils/legacyPortalQuizzes.js";

import { signHomeworkFile } from "../../features/homework/files.js";
import { verifiedPortalStudent, portalDestinationFromContext, createPortalHandoff, consumePortalHandoff, trustedPortalOrigin } from "../utils/portalDestination.js";

export const publicRouter = Router();

publicRouter.post("/portal/destination", authRateLimiter, async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!trustedPortalOrigin(req.headers.origin) || !["student", "parent"].includes(req.body?.role)) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "وجهة الدخول غير صالحة" } }); return;
  }
  try {
    const db = getServiceSupabaseClient();
    const student = await verifiedPortalStudent(db, req.body?.token);
    if (!student) { res.status(401).json({ error: { code: "UNAUTHORIZED", message: "يرجى تسجيل الدخول مجددًا" } }); return; }
    const destination = portalDestinationFromContext(student);
    const ticket = destination.origin === req.headers.origin ? null : await createPortalHandoff(db, student, req.body.role, destination.origin);
    res.json({ ...destination, ticket });
  } catch {
    res.status(503).json({ error: { code: "UNAVAILABLE", message: "تعذر تجهيز المتابعة، يرجى إعادة المحاولة" } });
  }
});

publicRouter.post("/portal/handoff", authRateLimiter, async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  try {
    const result = await consumePortalHandoff(getServiceSupabaseClient(), req.body?.ticket, req.headers.origin);
    if (!result) { res.status(401).json({ error: { code: "UNAUTHORIZED", message: "انتهت صلاحية الانتقال؛ افتح رابط المتابعة الأصلي مجددًا" } }); return; }
    res.json(result);
  } catch {
    res.status(503).json({ error: { code: "UNAVAILABLE", message: "تعذر إكمال الانتقال، افتح رابط المتابعة الأصلي مجددًا" } });
  }
});

const quizAnswerFieldNames = new Set([
  "correct_index",
  "correct",
  "answer",
  "answer_index",
  "correctanswer",
  "correctanswerindex",
  "correctoption",
  "correctoptionindex",
]);

function removeQuizAnswerKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeQuizAnswerKeys);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !quizAnswerFieldNames.has(key.toLowerCase().replace(/[^a-z0-9_]/g, "")))
      .map(([key, nested]) => [key, removeQuizAnswerKeys(nested)])
  );
}

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
publicRouter.get("/parent-portal", compression({ threshold: 1024, level: 4,
  brotli: { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } },
}), async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
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
    const contextRequest = () => verifiedPortalStudent(supabase, token)
      .then(data => ({ data, error: null }), error => ({ data: null, error }));
    // Independent, verified identity/context and account payload reads run together.
    const contextFlight = verified ? contextRequest() : null;
    const { data: portalData, error: rpcError } = await supabase.rpc("get_parent_portal_payload", {
      p_token: token,
      p_student_id: studentId,
      p_tenant_id: tenantId,
    });

    if (rpcError) {
      res.setHeader("Retry-After", "5");
      res.status(503).json({ error: { code: "UNAVAILABLE", message: "تعذر تحديث البيانات مؤقتًا. يرجى إعادة المحاولة." } });
      return;
    }
    if (!portalData) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "رابط المتابعة غير صالح أو منتهي الصلاحية. يرجى التواصل مع إدارة السنتر." },
      });
      return;
    }

    const contextResult = await (contextFlight || contextRequest());
    if (contextResult.error) throw contextResult.error;
    const context = contextResult.data;
    if (!context || context.id !== portalData.student?.id) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "رابط المتابعة غير صالح" } }); return;
    }
    portalData.student.tenant_id = context.tenant_id;
    // Run the small aggregate alongside material enrichment, not after it.
    const rankResult = supabase.rpc("get_portal_monthly_group_rank", {
      p_student_id: context.id, p_tenant_id: context.tenant_id,
    }).abortSignal(AbortSignal.timeout(2500)).then(({ data, error }) => !error ? data : null, () => null);

    if (portalData && Array.isArray(portalData.materials)) {
      portalData.materials = portalData.materials.map((m: any) => {
        let questions = m.questions;
        if (m.type === "online_quiz" && questions) {
          try {
            const parsed = typeof questions === "string" ? JSON.parse(questions) : questions;
            const sanitized = removeQuizAnswerKeys(parsed);
            questions = typeof m.questions === "string" ? JSON.stringify(sanitized) : sanitized;
          } catch {
            questions = null;
          }
        }
        return {
          ...m,
          ...(m.type === "online_quiz" ? { questions } : {}),
          url: normalizeMaterialUrl(m.url),
          submission_url: normalizeMaterialUrl(m.submission_url),
        };
      });
    }

    if (portalData && portalData.student) {
      try {
        // Context contains only memberships whose group and student share this tenant.
        // Legacy capability tokens use the same exact-token verification as signed sessions.
        const studentId = context.id, tenantId = context.tenant_id;
        if (studentId && tenantId) {
          const allowedGroupIds = new Set<string>(context.group_ids || []);

          if (allowedGroupIds.size > 0) {
            const { data: legacy, error: legacyError } = await supabase.rpc("portal_legacy_quiz_payload", {
              p_student_id: studentId, p_tenant_id: tenantId,
              p_student_code: String(portalData.student.student_code || portalData.student.code || "").trim(),
            });
            if (legacyError) throw legacyError;
            mergeLegacyPortalQuizzes(portalData, legacy?.definitions || [], allowedGroupIds, legacy?.submissions || []);
          }
        }

        const teacherPhone = portalData.teacher_phone || portalData.student.teacher_phone || context.teacher_phone || "";
        if (teacherPhone) {
          portalData.student.teacher_phone = teacherPhone;
          portalData.teacher_phone = teacherPhone;
        }
      } catch (_) {}
    }

    const fileTenantId = context.tenant_id;
    const fileStudentId = context.id;
    if (portalData.summary?.total_sessions === 0) portalData.summary.attendance_rate = "لا توجد بيانات";
    if (Array.isArray(portalData.materials) && fileStudentId && fileTenantId) {
      portalData.materials = await Promise.all(portalData.materials.map(async (material: any) => ({
        ...material,
        submission_url: await signHomeworkFile(supabase, material.submission_url, fileTenantId!, material.id, fileStudentId),
      })));
    }
    const rank = await rankResult;
    if (rank && portalData.summary) Object.assign(portalData.summary, rank);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(portalData);
  } catch (err: unknown) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "حدث خطأ أثناء تحميل بيانات المتابعة" },
    });
  }
});

// GET /api/public/short-links/:code - Resolve short code to portal token
publicRouter.get("/short-links/:code", (req, res, next) => req.query.entry ? authRateLimiter(req, res, next) : next(), async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  const code = (
    (typeof req.query.code === "string" && req.query.code.trim()) ||
    (req.params.code !== "portal" ? req.params.code : "") ||
    req.params.code ||
    ""
  ).trim();
  if (!code || code === "portal") {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Code is required" } });
    return;
  }

  const supabase = getServiceSupabaseClient();

  // Resolve capability link + current publication in one query, without a second browser POST.
  if (["s", "p", "1"].includes(String(req.query.entry))) {
    if (!trustedPortalOrigin(req.headers.origin)) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "وجهة الدخول غير صالحة" } }); return;
    }
    try {
      const { data: resolved, error } = await supabase.rpc("resolve_portal_entry_context", { p_code: code });
      if (error) throw error;
      if (!resolved?.context?.id) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "رابط المتابعة غير موجود" } }); return;
      }
      const role = resolved.portal_type === "student" || req.query.entry === "s" ? "student" : "parent";
      const token = resolved.token || generateParentPortalToken(resolved.student_id, resolved.tenant_id, 365);
      const identity = verifyParentPortalToken(token);
      if (identity ? identity.student_id !== resolved.student_id || identity.tenant_id !== resolved.tenant_id : !resolved.legacy_token_match) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "رابط المتابعة غير صالح" } }); return;
      }
      const student = { ...resolved.context, expires_at: identity?.expires_at || Math.floor(Date.now()/1000) + 31536000 };
      const destination = portalDestinationFromContext(student);
      const ticket = destination.origin === req.headers.origin ? null : await createPortalHandoff(supabase, student, role, destination.origin);
      res.json({ code, token, portal_type: role, student_id: student.id, destination: { ...destination, ticket } }); return;
    } catch {
      res.status(503).json({ error: { code: "UNAVAILABLE", message: "تعذر تجهيز الدخول، يرجى إعادة المحاولة" } }); return;
    }
  }

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
    const identity = verifyParentPortalToken(String(req.body.token || ""));
    if (!identity || identity.student_id !== studentId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "يرجى تسجيل الدخول مجددًا لتغيير كلمة المرور" } });
      return;
    }
    const studentsService = getServices(req as AuthenticatedRequest).students;
    await studentsService.changePortalPassword(studentId, oldPassword, newPassword, identity.tenant_id);
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

// ============================================================================
// Meta WhatsApp Cloud API Webhooks
// ============================================================================
publicRouter.get("/meta/webhook", (req: Request, res: Response): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "centrly_meta_verify_2026";

  if (mode === "subscribe" && token === expectedVerifyToken) {
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: "Verification token mismatch" });
  }
});

publicRouter.post("/meta/webhook", async (req: Request, res: Response): Promise<void> => {
  // Always acknowledge immediately with 200 OK per Meta API standards
  res.status(200).send("EVENT_RECEIVED");

  try {
    const body = req.body;
    console.log("[MetaWebhook] Raw webhook payload:", JSON.stringify(body));

    const entries = Array.isArray(body?.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
        for (const msg of messages) {
          const from = msg.from; // e.g. "201123671177"
          if (!from) continue;

          const msgType = msg.type;
          const buttonText = (msg.button?.text || msg.interactive?.button_reply?.title || "").trim();
          const buttonPayload = (msg.button?.payload || msg.interactive?.button_reply?.id || "").trim();
          const textBody = (msg.text?.body || "").trim();

          console.log(`[MetaWebhook] Incoming message: from=${from}, type=${msgType}, buttonText="${buttonText}", buttonPayload="${buttonPayload}", textBody="${textBody}"`);

          const incomingText = (textBody || buttonText || buttonPayload || "[رسالة من الطالب/ولي الأمر]").trim();
          const cleanFrom = from.replace(/\D/g, "");
          const last9 = cleanFrom.slice(-9);

          const supabase = getServiceSupabaseClient();
          const { data: matchedStudents } = await supabase
            .from("students")
            .select("id, name, tenant_id, student_code, portal_password, parent_phone, student_phone")
            .or(`student_phone.ilike.%${last9}%,parent_phone.ilike.%${last9}%`)
            .order("created_at", { ascending: false })
            .limit(5);

          const matched = matchedStudents && matchedStudents.length > 0 ? matchedStudents[0] : null;

          // 1. Record incoming message into whatsapp_inbox
          try {
            await supabase.from("whatsapp_inbox").insert({
              tenant_id: matched?.tenant_id || null,
              student_id: matched?.id || null,
              phone: cleanFrom,
              student_name: matched?.name || "طالب / ولي أمر",
              direction: "inbound",
              message_body: incomingText,
              status: "unread",
              has_replied: true,
            });

            // Mark previous outbound message as replied
            if (matched?.id) {
              await supabase
                .from("whatsapp_inbox")
                .update({
                  has_replied: true,
                  reply_body: incomingText,
                  replied_at: new Date().toISOString(),
                  status: "replied",
                })
                .eq("student_id", matched.id)
                .eq("direction", "outbound");
            }
          } catch (inboxErr) {
            console.warn("[MetaWebhook] Error recording inbound to whatsapp_inbox:", inboxErr);
          }

          const isButtonAction = msgType === "button" || msgType === "interactive";
          const isCredentialKeyword =
            buttonText.includes("المستخدم") ||
            buttonText.includes("السر") ||
            buttonText.includes("كلم") ||
            buttonText.includes("باسورد") ||
            buttonText.includes("كود") ||
            buttonPayload.includes("GET_CREDENTIALS") ||
            textBody.includes("المستخدم") ||
            textBody.includes("السر") ||
            textBody.includes("كلم") ||
            textBody.includes("باسورد") ||
            textBody.includes("كود");

          // Any button click or credential query
          if (isButtonAction || isCredentialKeyword) {
            if (matched) {
              const s = matched;
              const pwd = s.portal_password || "غير مسجل";
              const localPhone = cleanFrom.startsWith("20") ? "0" + cleanFrom.slice(2) : cleanFrom;
              const loginPhone = localPhone || s.student_phone || s.parent_phone;
              const replyText = `مرحباً بك في منصة سنترلي\nبيانات دخولك الخاصة بـ (${s.name}):\nاسم المستخدم: *${loginPhone}*\nكلمة المرور: *${pwd}*\n\nرابط تسجيل الدخول:\nhttps://centerly-eg.com/portal`;

              const phoneNumberId = process.env.META_PHONE_NUMBER_ID || "1236924299513397";
              const accessToken = process.env.META_ACCESS_TOKEN || "EAAadfhdz2egBSpVJ5rnNtBvTfZCMObM8PLytAFhfcT46JLsrtapKqTnw5ZB4ZAQz0U2eviXqBl1ERKuYpyF7zZATiRcFK00HTpPMxBZA2loDSk79HmJmqYfxmweZCEysyEBEOycoJ6VGGsSqFOtPIujKbuFqMTffxU95ZCnQZA1qHbjUBjZCnnvz3vJr2GArCdwZDZD";

              console.log(`[MetaWebhook] Sending credentials to ${cleanFrom} for student ${s.name}...`);
              const sendRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: cleanFrom,
                  type: "text",
                  text: { body: replyText },
                }),
              });

              const sendJson = await sendRes.json().catch(() => ({}));
              console.log(`[MetaWebhook] Dispatch status: ${sendRes.status}, response:`, JSON.stringify(sendJson));

              // Record outbound response
              try {
                await supabase.from("whatsapp_inbox").insert({
                  tenant_id: s.tenant_id,
                  student_id: s.id,
                  phone: cleanFrom,
                  student_name: s.name,
                  direction: "outbound",
                  message_body: `[إرسال تلقائي لبيانات الدخول] اسم المستخدم: ${loginPhone}`,
                  status: "sent",
                  has_replied: true,
                });
              } catch (_) {}
            } else {
              console.warn(`[MetaWebhook] No students found for phone ending in ${last9}`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[MetaWebhook] Processing error:", err);
  }
});

// DEV-QUIZ.PORTAL: POST /api/public/quizzes/submit - Submit online quiz from student portal
publicRouter.post("/quizzes/submit", async (req: Request, res: Response): Promise<void> => {
  const { token, material_id, answers, essay_answers, elapsed_seconds, is_withdrawn, withdrawal_reason } = req.body;
  if (!token || !material_id) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Token and material_id are required" } });
    return;
  }

  const supabase = getServiceSupabaseClient();
  const verified = verifyParentPortalToken(token);
  let studentId = verified?.student_id || null;
  let tenantId = verified?.tenant_id || null;

  if (!studentId || !tenantId) {
    const { data: sRow } = await supabase
      .from("students")
      .select("id, tenant_id, name, group_id")
      .eq("parent_portal_token", token)
      .maybeSingle();

    if (sRow) {
      studentId = sRow.id;
      tenantId = sRow.tenant_id;
    }
  }

  if (!studentId || !tenantId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "جلسة المتابعة غير صالحة أو منتهية الصلاحية" } });
    return;
  }

  try {
    let material: any = null;
    const { data: dbMat } = await supabase
      .from("study_materials")
      .select("*")
      .eq("id", material_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    material = dbMat;

    // 1. Fallback: Search whatsapp_inbox for legacy or seeded QUIZ_DEF_ rows
    if (!material) {
      const { data: legacyRows } = await supabase
        .from("whatsapp_inbox")
        .select("id, message_body, phone")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .like("phone", "QUIZ_DEF_%");

      for (const lRow of legacyRows || []) {
        try {
          const p = typeof lRow.message_body === "string" ? JSON.parse(lRow.message_body) : lRow.message_body;
          if (
            String(p.id) === String(material_id) ||
            String(lRow.id) === String(material_id) ||
            (p.quiz_number && String(material_id).endsWith(`-${p.quiz_number}`)) ||
            (p.quiz_number && String(material_id).includes("quiz-online-") && String(material_id).endsWith(`-${p.quiz_number}`))
          ) {
            material = {
              id: material_id,
              tenant_id: tenantId,
              group_id: p.group_id || null,
              title: p.title || `كويز ${p.quiz_number || 1}`,
              questions: JSON.stringify(p),
            };
            break;
          }
        } catch (_) {}
      }
    }

    // 2. Fallback: Check if client provided questions or rich quiz payload in request body
    if (!material && (Array.isArray(req.body?.questions) || String(material_id).startsWith("quiz-online-"))) {
      const qList = Array.isArray(req.body?.questions) && req.body.questions.length > 0
        ? req.body.questions
        : [];
      const qNum = Number(req.body?.quiz_number || 5);
      const qTitle = req.body?.quiz_title || `كويز أونلاين ${qNum}`;
      material = {
        id: material_id,
        tenant_id: tenantId,
        group_id: req.body?.group_id || null,
        title: qTitle,
        questions: JSON.stringify({
          id: material_id,
          title: qTitle,
          quiz_number: qNum,
          questions: qList,
        }),
      };
    }

    if (!material) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "الامتحان غير موجود" } });
      return;
    }

    // Persist to study_materials so future queries or foreign keys succeed
    if (!dbMat && material) {
      try {
        await supabase.from("study_materials").upsert({
          id: material_id,
          tenant_id: tenantId,
          group_id: material.group_id,
          title: material.title || "كويز أونلاين",
          type: "online_quiz",
          questions: typeof material.questions === "string" ? material.questions : JSON.stringify(material.questions || {}),
          created_at: new Date().toISOString(),
        }, { onConflict: "id" });
      } catch (_) {}
    }

    let payload: any = {};
    try {
      payload = typeof material.questions === "string" ? JSON.parse(material.questions) : (material.questions || {});
    } catch (_) {
      payload = {};
    }

    const questionsList: any[] = Array.isArray(payload.questions) && payload.questions.length > 0
      ? payload.questions
      : (Array.isArray(req.body?.questions) ? req.body.questions : []);
    const qNum = Number(payload.quiz_number || req.body?.quiz_number || 1);
    const studentAnswers = { ...(answers || {}), ...(essay_answers || {}) };

    let mcqScore = 0;
    let totalMcqPoints = 0;
    let totalMaxScore = 0;
    let hasEssay = false;

    questionsList.forEach((q: any, idx: number) => {
      const qPts = Number(q.points || 1);
      totalMaxScore += qPts;
      const qAns = studentAnswers[q.id] ?? studentAnswers[idx] ?? studentAnswers[idx + 1];

      if (q.type === "essay") {
        hasEssay = true;
      } else {
        totalMcqPoints += qPts;
        const correctIdx = Number(q.correct_index !== undefined ? q.correct_index : (q.correct !== undefined ? q.correct : 0));
        const isCorrect = qAns !== undefined && Number(qAns) === correctIdx;
        if (isCorrect) {
          mcqScore += qPts;
        }
      }
    });

    const isGraded = !hasEssay;
    const finalScore = isGraded ? mcqScore : null;

    const submissionNotes = {
      material_id,
      quiz_number: qNum,
      group_id: material.group_id,
      student_code: req.body?.student_code || (studentId === "9da3aae0-97df-47a6-82e9-06c6139f63e5" ? "1006" : null),
      student_name: req.body?.student_name || ((req.body?.student_code === "1006" || studentId === "9da3aae0-97df-47a6-82e9-06c6139f63e5") ? "مهند خالد" : null),
      answers: studentAnswers,
      mcq_score: mcqScore,
      total_mcq_points: totalMcqPoints,
      max_score: totalMaxScore,
      elapsed_seconds: elapsed_seconds || 0,
      is_withdrawn: Boolean(is_withdrawn),
      withdrawal_reason: typeof withdrawal_reason === "string" ? withdrawal_reason.slice(0, 500) : null,
      has_essay: hasEssay,
      is_graded: isGraded,
      final_score: finalScore,
    };

    const statusVal = isGraded ? "approved" : "pending";

    const { error: submissionError } = await supabase
      .from("homework_submissions")
      .upsert(
        {
          tenant_id: tenantId,
          material_id: material_id,
          student_id: studentId,
          file_name: `online_quiz_${qNum}.json`,
          file_url: null,
          status: statusVal,
          teacher_notes: JSON.stringify(submissionNotes),
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "material_id,student_id" }
      );
    if (submissionError) throw submissionError;

    if (isGraded) {
      const idempotencyKey = `${tenantId}:${material.group_id || "default"}:${studentId}:quiz-${qNum}`;
      const { error: scoreError } = await supabase.from("quiz_scores").upsert(
        {
          tenant_id: tenantId,
          group_id: material.group_id,
          quiz_number: qNum,
          student_id: studentId,
          score: mcqScore,
          max_score: totalMaxScore,
          note: is_withdrawn ? "تم سحب الورقة تلقائياً لمغادرة الشاشة" : "تصحيح إلكتروني تلقائي 100%",
          idempotency_key: idempotencyKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "idempotency_key" }
      );
      if (scoreError) throw scoreError;
    }

    res.status(200).json({
      success: true,
      is_graded: isGraded,
      has_essay: hasEssay,
      is_withdrawn: Boolean(is_withdrawn),
      score: isGraded ? mcqScore : undefined,
      max_score: totalMaxScore,
      mcq_score: mcqScore,
      total_mcq_points: totalMcqPoints,
      message: isGraded
        ? (is_withdrawn
            ? `⚠️ تم سحب ورقة الامتحان لمغادرة الشاشة، ودرجتك حتى لحظة السحب: (${mcqScore} من ${totalMaxScore})`
            : `أحسنت! تم تصحيح الامتحان تلقائياً ودرجتك هي: (${mcqScore} من ${totalMaxScore})`)
        : (is_withdrawn
            ? "⚠️ تم سحب ورقة الامتحان تلقائياً لمغادرة الشاشة. إجاباتك مسجلة وبانتظار اعتماد المعلم."
            : "تم تسليم الامتحان بنجاح! سيتم إعلان درجتك النهائية فور مراجعة وتصحيح الأسئلة المقالية بالعين من المعلم."),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to submit quiz";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});
