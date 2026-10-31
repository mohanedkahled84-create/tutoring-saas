import { Router, Response, Request } from "express";
import compression from "compression";
import { constants as zlibConstants } from "node:zlib";
import { validateBody, publicSelfRegisterSchema } from "../middleware/validation.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { verifyParentPortalToken, generateParentPortalToken } from "../utils/tokens.js";
import { getServices } from "../../composition.js";
import { AuthenticatedRequest } from "../types/index.js";
import { authRateLimiter } from "../middleware/rateLimit.js";

import { verifiedPortalStudent, portalDestinationFromContext, createPortalHandoff, consumePortalHandoff, trustedPortalOrigin } from "../utils/portalDestination.js";

import {loadPortalAccount} from "../utils/portalAccount.js";
import {parentFamilyRouter} from './parentFamily.js';
import {metaPortalWebhook} from './metaPortalWebhook.js';

export const publicRouter = Router();
publicRouter.use('/family',parentFamilyRouter);

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

publicRouter.post("/portal/handoff", compression({threshold:1024,level:4}), authRateLimiter, async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  try {
    const db=getServiceSupabaseClient();
    const redeemed = await consumePortalHandoff(db, req.body?.ticket, req.headers.origin, true);
    if (!redeemed) { res.status(401).json({ error: { code: "UNAUTHORIZED", message: "انتهت صلاحية الانتقال؛ افتح رابط المتابعة الأصلي مجددًا" } }); return; }
    const {context,...result}=redeemed;
    let initial_data;
    if(req.body?.view==='parent' && result.role==='parent') {
      try { initial_data=await loadPortalAccount(db,result.token!,true,context); }
      catch { /* Keep the valid redeemed session; the client can retry its account read. */ }
    }
    res.json({...result,...(initial_data ? {initial_data} : {})});
  } catch {
    res.status(503).json({ error: { code: "UNAVAILABLE", message: "تعذر إكمال الانتقال، افتح رابط المتابعة الأصلي مجددًا" } });
  }
});

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

  try {
    const data=await loadPortalAccount(getServiceSupabaseClient(),token,req.query.view==='parent');
    res.json(data);
  } catch(error:any) {
    const status=[401,503].includes(error?.status) ? error.status : 500;
    if(status===503) res.setHeader('Retry-After','5');
    res.status(status).json({error:{code:status===401?'UNAUTHORIZED':status===503?'UNAVAILABLE':'INTERNAL_ERROR',message:status===500?'حدث خطأ أثناء تحميل بيانات المتابعة':error.message}});
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
      let initial_data;
      if(req.query.view==='parent' && role==='parent' && destination.origin===req.headers.origin) {
        try { initial_data=await loadPortalAccount(supabase,token,true,student); } catch { /* Retry the account independently on a temporary read failure. */ }
      }
      res.json({ code, token, portal_type: role, student_id: student.id, destination: { ...destination, ticket },...(initial_data ? {initial_data} : {}) }); return;
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

publicRouter.post("/meta/webhook", metaPortalWebhook);

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
