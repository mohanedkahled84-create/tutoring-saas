import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServices } from "../../composition.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { config } from "../../shared/config/index.js";
import { validateFileUpload } from "../../shared/utils/fileUploadValidator.js";
import { getStealthModelQuestions } from "./stealthModels.js";

export const quizzesRouter = Router();

function parseQuizPayload(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function mergeLegacyQuizRows(
  rows: any[],
  allowedGroupIds: Set<string>,
  groupId: string,
  richQuizzes: any[],
  drafts: any[]
): void {
  for (const row of rows || []) {
    const legacyQuiz = parseQuizPayload(row.message_body);
    let legacyGroupId = String(legacyQuiz.group_id || "");

    if (!legacyGroupId && row.phone) {
      const match = String(row.phone).match(/QUIZ_DEF_(?:PAPER_|ONLINE_)?([^_]+)_(\d+)/);
      if (match) {
        legacyGroupId = match[1];
        legacyQuiz.group_id = legacyGroupId;
        if (!legacyQuiz.quiz_number) legacyQuiz.quiz_number = Number(match[2]);
      }
    }

    if (String(row.phone || "").includes("PAPER_") || row.status === "paper") {
      legacyQuiz.exam_mode = legacyQuiz.exam_mode || "paper";
    }

    if (legacyGroupId && legacyGroupId !== "all" && allowedGroupIds.size > 0 && !allowedGroupIds.has(legacyGroupId)) continue;
    if (groupId && groupId !== "all" && legacyGroupId && legacyGroupId !== "all" && legacyGroupId !== groupId) continue;

    const isDraft = Boolean(legacyQuiz.is_draft || row.status === "draft" || String(row.phone).includes("DRAFT"));
    if (isDraft) {
      const draft: any = { ...legacyQuiz, is_draft: true, is_archived: true };
      if (!drafts.some((existing: any) => existing.id === draft.id)) drafts.push(draft);
      continue;
    }

    const alreadyLoaded = richQuizzes.some((quiz: any) =>
      quiz.id === legacyQuiz.id || (
        String(quiz.group_id) === legacyGroupId &&
        Number(quiz.quiz_number) === Number(legacyQuiz.quiz_number) &&
        (quiz.exam_mode || "online") === (legacyQuiz.exam_mode || "online")
      )
    );
    if (!alreadyLoaded && Array.isArray(legacyQuiz.questions)) {
      richQuizzes.push({ ...legacyQuiz, created_at: legacyQuiz.created_at || row.created_at });
    }
  }
}

async function saveTenantQuizDraft(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  tenantId: string,
  draft: Record<string, unknown>
): Promise<void> {
  const id = String(draft.id || `draft_${draft.exam_mode || "online"}_${Date.now()}`);
  const examMode = String(draft.exam_mode || "online");
  const phone = `QUIZ_DEF_DRAFT_${id}`;
  const now = new Date().toISOString();
  const normalizedDraft = {
    ...draft,
    id,
    title: String(draft.title || "").trim() || (examMode === "paper" ? "مسودة امتحان ورقي" : "مسودة امتحان إلكتروني"),
    subject: String(draft.subject || "").trim() || "الفيزياء",
    questions: Array.isArray(draft.questions) ? draft.questions : [],
    is_draft: true,
    is_archived: true,
    status: "draft",
    updated_at: now,
  };

  const { data: existing, error: lookupError } = await supabase
    .from("whatsapp_inbox")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("phone", phone)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await supabase
      .from("whatsapp_inbox")
      .update({ message_body: JSON.stringify(normalizedDraft), status: "draft", updated_at: now })
      .eq("id", existing.id)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("whatsapp_inbox").insert({
    tenant_id: tenantId,
    phone,
    direction: "outbound",
    message_body: JSON.stringify(normalizedDraft),
    status: "draft",
    updated_at: now,
  });
  if (error) throw error;
}

// GET /api/quizzes - Fetch quizzes and all student scores for a given group
quizzesRouter.get(
  "/",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const groupId = (req.query.group_id as string) || "";

    try {
      const services = getServices(req);
      const quizzesService = services.quizzes;

      const data = await quizzesService.listGroupQuizzesData(tenantId, groupId);
      res.status(200).json({
        success: true,
        ...data,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch quizzes";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// POST /api/quizzes - Create or update a single quiz definition
quizzesRouter.post(
  "/",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const { id, group_id, quiz_number, title, max_score, quiz_date, is_skipped } = req.body;

    if (!group_id || quiz_number === undefined) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "group_id and quiz_number are required" },
      });
      return;
    }

    try {
      const services = getServices(req);
      const quiz = await services.quizzes.upsertQuiz(tenantId, {
        id,
        group_id,
        quiz_number: Number(quiz_number),
        title: title || `كويز ${quiz_number}`,
        max_score: max_score !== undefined ? Number(max_score) : 10,
        quiz_date,
        is_skipped: Boolean(is_skipped),
      });

      res.status(200).json({ success: true, quiz });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upsert quiz";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-QUIZ.2: POST /api/quizzes/dispatch-scores - Batch dispatch quiz scores with Ultra Anti-Ban pacing & variations
quizzesRouter.post(
  "/dispatch-scores",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const {
      group_id,
      quiz_number,
      quiz_title,
      max_score,
      teacher_id,
      teacher_name,
      students,
      pacing_delay_ms,
      daily_cap,
    } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "students array must not be empty" },
      });
      return;
    }

    try {
      const services = getServices(req);
      const whatsAppService = services.whatsapp;
      const quizzesService = services.quizzes;

      const resolvedTeacherId =
        teacher_id ||
        req.user?.teacher_id ||
        (req.user?.role === "teacher" ? req.user?.id : "default");

      const target = (req.body.target === "parents" || req.body.target === "students" || req.body.target === "both")
        ? req.body.target
        : "both";

      const result = await whatsAppService.batchSendQuizScores(
        tenantId,
        students.map((s: {
          student_id?: string;
          id?: string;
          student_name?: string;
          name?: string;
          parent_phone?: string;
          student_phone?: string;
          phone?: string;
          score: number | string;
          note?: string;
        }) => ({
          student_id: s.student_id || s.id || "",
          student_name: s.student_name || s.name || "الطالب",
          parent_phone: s.parent_phone || "",
          student_phone: s.student_phone || s.phone || "",
          score: Number(s.score),
          note: s.note,
        })),
        {
          quiz_title: quiz_title || "الكويز",
          max_score: max_score ? Number(max_score) : 10,
          teacher_id: resolvedTeacherId,
          teacher_name,
          pacingDelayMs: pacing_delay_ms,
          dailyCap: daily_cap,
          target,
        }
      );

      // Update delivery statuses in quiz_scores table if group_id and quiz_number provided
      if (group_id && quiz_number !== undefined) {
        for (const r of result.results) {
          await quizzesService.updateDeliveryStatus(
            tenantId,
            group_id,
            Number(quiz_number),
            r.student_id,
            r.status === "sent" ? "sent" : "failed"
          ).catch(() => {});
        }
      }

      res.status(200).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to dispatch quiz scores";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-QUIZ.3: POST /api/quizzes/scores - Save quiz scores to repository
quizzesRouter.post(
  "/scores",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const { session_id, group_id, quiz_number, quiz_title, max_score, scores, notes } = req.body;

    if (!scores || typeof scores !== "object") {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "scores object is required" },
      });
      return;
    }

    const qNum = quiz_number !== undefined ? Number(quiz_number) : 1;
    const resolvedGroupId = group_id || "default-group";

    try {
      const services = getServices(req);
      const quizzesService = services.quizzes;

      // 1. Save to Quizzes Service (persisting to quizzes and quiz_scores with group_id)
      const { savedCount } = await quizzesService.saveScores(tenantId, {
        group_id: resolvedGroupId,
        quiz_number: qNum,
        quiz_title: quiz_title || `كويز ${qNum}`,
        max_score: max_score ? Number(max_score) : 10,
        scores,
        notes,
      });

      // 2. Backward compatibility with session-based tests if session_id is a valid UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session_id || "");
      if (isUUID) {
        const sessionsService = services.sessions;
        for (const [studentId, scoreVal] of Object.entries(scores)) {
          if (scoreVal !== undefined && scoreVal !== null && scoreVal !== "") {
            await sessionsService.saveQuizScore(
              tenantId,
              session_id,
              studentId,
              Number(scoreVal),
              max_score ? Number(max_score) : 10
            ).catch(() => {});
          }
        }
      }

      res.status(200).json({
        success: true,
        message: "Quiz scores saved successfully",
        count: savedCount,
      });
    } catch (err: unknown) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to save quiz scores",
          details: (err as Error).message,
        },
      });
    }
  }
);

// DEV-QUIZ.RICH-1: GET /api/quizzes/rich - Fetch rich online quiz definitions
quizzesRouter.get(
  "/rich",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const groupId = (req.query.group_id as string) || "";

    try {
      const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();
      let query = supabase
        .from("study_materials")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("type", ["online_quiz", "paper_quiz", "paper_exam"])
        .order("created_at", { ascending: false });

      if (groupId && groupId !== "all") {
        query = query.or(`group_id.eq.${groupId},group_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let allowedGroupIds = new Set<string>();
      try {
        const { data: tenantGroups } = await supabase
          .from("groups")
          .select("id")
          .eq("tenant_id", tenantId);
        if (tenantGroups) {
          allowedGroupIds = new Set(tenantGroups.map((group: any) => String(group.id)));
        }
      } catch (_) {}

      let draftRows: any[] = [];
      let legacyRows: any[] = [];
      try {
        const [draftRes, legacyRes] = await Promise.all([
          supabase
            .from("whatsapp_inbox")
            .select("message_body, phone, status")
            .eq("tenant_id", tenantId)
            .like("phone", "QUIZ_DEF_DRAFT_%")
            .order("updated_at", { ascending: false }),
          supabase
            .from("whatsapp_inbox")
            .select("id, message_body, phone, status, created_at, tenant_id")
            .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
            .like("phone", "QUIZ_DEF_%")
            .order("created_at", { ascending: false }),
        ]);
        if (draftRes.data) draftRows = draftRes.data;
        if (legacyRes.data) legacyRows = legacyRes.data;
      } catch (inboxErr) {
        console.warn("[Quizzes] Note: whatsapp_inbox read skipped:", inboxErr);
      }

      const richQuizzes: any[] = (data || []).map((row: any) => {
        let payload: any = {};
        try {
          payload = typeof row.questions === "string" ? JSON.parse(row.questions) : (row.questions || {});
        } catch (_) {
          payload = {};
        }

        const questionsList = Array.isArray(payload.questions) ? payload.questions : [];
        const maxScore = questionsList.reduce((acc: number, q: any) => acc + Number(q.points || 1), 0) || 10;

        return {
          id: row.id,
          title: row.title,
          subject: row.description || payload.subject || "الفيزياء",
          group_id: row.group_id,
          quiz_number: payload.quiz_number !== undefined ? Number(payload.quiz_number) : 1,
          time_limit_minutes: Number(payload.time_limit_minutes) || 20,
          available_date: payload.available_date || null,
          start_time: payload.start_time || null,
          end_time: payload.end_time || null,
          exam_mode: payload.exam_mode || "online",
          questions: questionsList,
          stealth_models: payload.stealth_models || null,
          max_score: maxScore,
          created_at: row.created_at,
        };
      });

      const drafts: any[] = (draftRows || [])
        .map((row) => parseQuizPayload(row.message_body))
        .filter((draft) => typeof draft.id === "string" && Array.isArray(draft.questions))
        .map((draft) => ({ ...draft, is_draft: true, is_archived: true }));

      mergeLegacyQuizRows(legacyRows || [], allowedGroupIds, groupId, richQuizzes, drafts);

      res.status(200).json({ success: true, quizzes: richQuizzes, drafts });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch rich quizzes";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-QUIZ.RICH-2: POST /api/quizzes/rich - Create or update a rich online quiz definition
quizzesRouter.post(
  "/rich",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();
    const action = req.body?.action;

    if (action === "delete_draft") {
      const id = typeof req.body?.id === "string" ? req.body.id : "";
      if (!id) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: "Draft id is required" } });
        return;
      }
      try {
        const { error } = await supabase
          .from("whatsapp_inbox")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("phone", `QUIZ_DEF_DRAFT_${id}`);
        if (error) throw error;
        res.status(200).json({ success: true, message: "Draft deleted successfully" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to delete quiz draft";
        res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
      }
      return;
    }

    if (action === "delete_quiz" || action === "archive_quiz") {
      const id = typeof req.body?.id === "string" ? req.body.id : "";
      const quizToArchive = parseQuizPayload(req.body?.quiz ?? req.body);
      try {
        if (action === "archive_quiz") {
          await saveTenantQuizDraft(supabase, tenantId, {
            ...quizToArchive,
            id: id || quizToArchive.id,
            is_draft: true,
            is_archived: true,
            status: "draft",
            archived_at: new Date().toISOString(),
          });
        }

        if (id && id.length > 20) {
          const { error } = await supabase
            .from("study_materials")
            .delete()
            .eq("id", id)
            .eq("tenant_id", tenantId)
            .eq("type", "online_quiz");
          if (error) throw error;
        }

        res.status(200).json({
          success: true,
          message: action === "archive_quiz" ? "Quiz archived successfully" : "Quiz deleted successfully",
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update quiz";
        res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
      }
      return;
    }

    const {
      id,
      group_id,
      quiz_number,
      title,
      subject,
      time_limit_minutes,
      available_date,
      start_time,
      end_time,
      exam_mode,
      questions,
      stealth_models,
      is_draft,
      status,
    } = req.body;

    if (is_draft === true || status === "draft") {
      try {
        await saveTenantQuizDraft(supabase, tenantId, parseQuizPayload(req.body || {}));
        res.status(200).json({ success: true, is_draft: true, draft: req.body, quiz: req.body });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to save quiz draft";
        res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
      }
      return;
    }

    if (!group_id || quiz_number === undefined) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "group_id and quiz_number are required" },
      });
      return;
    }

    const qNum = Number(quiz_number);
    const questionsArr = Array.isArray(questions) ? questions : [];
    const maxScore = questionsArr.reduce((sum: number, q: any) => sum + Number(q.points || 1), 0) || 10;
    const cleanTitle = (title && title.trim()) || `كويز ${qNum}`;
    const cleanSubject = (subject && subject.trim()) || "الفيزياء";
    const cleanTimeLimit = Number(time_limit_minutes) || 20;

    try {
      const services = getServices(req);
      const quizzesService = services.quizzes;
      // 1. Ensure record exists in quizzes table for group tracking
      await quizzesService.upsertQuiz(tenantId, {
        group_id,
        quiz_number: qNum,
        title: cleanTitle,
        max_score: maxScore,
        quiz_date: available_date || new Date().toISOString().slice(0, 10),
        is_skipped: false,
      });

      // 2. Prepare payload for study_materials
      const questionsPayload = JSON.stringify({
        quiz_number: qNum,
        subject: cleanSubject,
        time_limit_minutes: cleanTimeLimit,
        available_date: available_date || null,
        start_time: start_time || null,
        end_time: end_time || null,
        exam_mode: exam_mode || "online",
        questions: questionsArr,
        stealth_models: stealth_models || null,
      });

      let materialRecord: any;
      if (id && id.length > 20) {
        const { data: updated, error } = await supabase
          .from("study_materials")
          .update({
            title: cleanTitle,
            description: cleanSubject,
            group_id,
            questions: questionsPayload,
          })
          .eq("id", id)
          .eq("tenant_id", tenantId)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (updated) {
          materialRecord = updated;
        } else {
          const { data, error: insertError } = await supabase
            .from("study_materials")
            .insert({
              id,
              tenant_id: tenantId,
              teacher_id: req.user?.id || null,
              title: cleanTitle,
              description: cleanSubject,
              type: "online_quiz",
              group_id,
              is_homework: false,
              questions: questionsPayload,
            })
            .select()
            .single();
          if (insertError) throw insertError;
          materialRecord = data;
        }
      } else {
        // Check if one already exists for this group and quiz_number
        const { data: existingRows } = await supabase
          .from("study_materials")
          .select("id, questions")
          .eq("tenant_id", tenantId)
          .eq("group_id", group_id)
          .eq("type", "online_quiz");

        const matched = (existingRows || []).find((r: any) => {
          try {
            const p = JSON.parse(r.questions || "{}");
            return Number(p.quiz_number) === qNum && (p.exam_mode || "online") === (exam_mode || "online");
          } catch (_) {
            return false;
          }
        });

        if (matched) {
          const { data, error } = await supabase
            .from("study_materials")
            .update({
              title: cleanTitle,
              description: cleanSubject,
              questions: questionsPayload,
            })
            .eq("id", matched.id)
            .select()
            .single();
          if (error) throw error;
          materialRecord = data;
        } else {
          const { data, error } = await supabase
            .from("study_materials")
            .insert({
              tenant_id: tenantId,
              teacher_id: req.user?.id || null,
              title: cleanTitle,
              description: cleanSubject,
              type: "online_quiz",
              group_id,
              is_homework: false,
              questions: questionsPayload,
            })
            .select()
            .single();
          if (error) throw error;
          materialRecord = data;
        }
      }

      try {
        const modePrefix = exam_mode === "paper" ? "PAPER_" : "ONLINE_";
        const fallbackPhone = `QUIZ_DEF_${modePrefix}${group_id}_${qNum}`;
        await supabase.from("whatsapp_inbox").upsert({
          tenant_id: tenantId,
          phone: fallbackPhone,
          direction: "outbound",
          message_body: JSON.stringify({
            id: materialRecord.id,
            title: cleanTitle,
            subject: cleanSubject,
            group_id,
            quiz_number: qNum,
            time_limit_minutes: cleanTimeLimit,
            exam_mode: exam_mode || "online",
            questions: questionsArr,
            created_at: new Date().toISOString()
          }),
          status: exam_mode || "online"
        }, { onConflict: "phone" });
      } catch (_) {}

      res.status(200).json({
        success: true,
        quiz: {
          id: materialRecord.id,
          title: cleanTitle,
          subject: cleanSubject,
          group_id,
          quiz_number: qNum,
          time_limit_minutes: cleanTimeLimit,
          exam_mode: exam_mode || "online",
          max_score: maxScore,
          questions: questionsArr,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save rich quiz";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-QUIZ.RICH-3: POST /api/quizzes/upload-image - Upload question image
quizzesRouter.post(
  "/upload-image",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const { image_data, file_name } = req.body;

    if (!image_data) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "image_data is required" } });
      return;
    }

    try {
      const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();

      let contentType = "image/png";
      const mimeMatch = image_data.match(/^data:([^;]+);base64,/);
      if (mimeMatch && mimeMatch[1]) {
        contentType = mimeMatch[1].toLowerCase();
      }

      const base64Clean = image_data.replace(/^data:[^;]+;base64,/, "");
      const fileBuffer = Buffer.from(base64Clean, "base64");

      const validation = validateFileUpload({
        buffer: fileBuffer,
        originalFilename: file_name || "question.png",
        declaredMimeType: contentType,
        maxSizeBytes: 20 * 1024 * 1024,
      });

      if (!validation.isValid || !validation.sanitizedFilename || !validation.detectedMimeType) {
        res.status(400).json({ error: { code: "INVALID_FILE", message: validation.error || "نوع الصورة غير مدعوم" } });
        return;
      }

      const storagePath = `quizzes/${tenantId}/${Date.now()}_${validation.sanitizedFilename}`;
      const { error: uploadError } = await supabase.storage
        .from("homework-submissions")
        .upload(storagePath, fileBuffer, {
          contentType: validation.detectedMimeType,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from("homework-submissions")
        .getPublicUrl(storagePath);

      let finalUrl = publicUrlData.publicUrl;
      if (finalUrl.includes("/storage/v1/object/sign/homework-submissions/")) {
        finalUrl = finalUrl.replace("/storage/v1/object/sign/homework-submissions/", "/storage/v1/object/public/homework-submissions/").split("?")[0];
      }

      res.status(200).json({ success: true, url: finalUrl });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload question image";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-QUIZ.RICH-4B: GET /api/quizzes/submissions - List online quiz submissions (graded & pending)
quizzesRouter.get(
  "/submissions",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const groupId = (req.query.group_id as string) || "";
    const statusFilter = (req.query.status as string) || "all";

    try {
      const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();

      let query = supabase
        .from("homework_submissions")
        .select(`
          id,
          tenant_id,
          student_id,
          material_id,
          file_name,
          status,
          file_url,
          teacher_notes,
          submitted_at
        `)
        .eq("tenant_id", tenantId)
        .order("submitted_at", { ascending: false });

      if (statusFilter === "pending") {
        query = query.eq("status", "needs_grading");
      } else if (statusFilter === "graded") {
        query = query.eq("status", "approved");
      } else {
        query = query.in("status", ["needs_grading", "approved"]);
      }

      const { data: subs, error: subsError } = await query;
      if (subsError) throw subsError;

      // Filter only online quiz submissions (file_name starts with online_quiz_ or teacher_notes contains quiz metadata)
      const onlineSubs = (subs || []).filter((s: any) => {
        if (s.file_name && s.file_name.startsWith("online_quiz_")) return true;
        try {
          const notes = typeof s.teacher_notes === "string" ? JSON.parse(s.teacher_notes) : s.teacher_notes;
          if (notes && (notes.quiz_number !== undefined || notes.mcq_score !== undefined)) return true;
        } catch (_) {}
        return false;
      });

      if (onlineSubs.length === 0) {
        res.status(200).json({ success: true, submissions: [] });
        return;
      }

      const studentIds = [...new Set(onlineSubs.map((s: any) => s.student_id))];
      const materialIds = [...new Set(onlineSubs.map((s: any) => s.material_id))];

      const { data: studentsData } = await supabase
        .from("students")
        .select("id, name, student_code, group_id, student_phone")
        .in("id", studentIds);

      const { data: materialsData } = await supabase
        .from("study_materials")
        .select("id, title, description, questions, group_id")
        .in("id", materialIds);

      const studentMap = new Map((studentsData || []).map((s: any) => [s.id, s]));
      const materialMap = new Map((materialsData || []).map((m: any) => [m.id, m]));

      const results = onlineSubs
        .filter((sub: any) => {
          if (!groupId) return true;
          const s = studentMap.get(sub.student_id);
          const m = materialMap.get(sub.material_id);
          return (s && String(s.group_id) === String(groupId)) || (m && String(m.group_id) === String(groupId));
        })
        .map((sub: any) => {
          const student = studentMap.get(sub.student_id) || {};
          const material = materialMap.get(sub.material_id) || {};
          let parsedNotes: any = {};
          try {
            parsedNotes = typeof sub.teacher_notes === "string" ? JSON.parse(sub.teacher_notes) : (sub.teacher_notes || {});
          } catch (_) {
            parsedNotes = {};
          }

          let materialQuestions: any = {};
          try {
            materialQuestions = typeof material.questions === "string" ? JSON.parse(material.questions) : (material.questions || {});
          } catch (_) {
            materialQuestions = {};
          }

          const hasEssay = Boolean(parsedNotes.has_essay);
          const isGraded = sub.status === "approved" || parsedNotes.is_graded === true;
          const finalScore = parsedNotes.final_score !== undefined && parsedNotes.final_score !== null
            ? Number(parsedNotes.final_score)
            : (isGraded ? Number(parsedNotes.mcq_score || 0) : null);

          return {
            id: sub.id,
            submission_id: sub.id,
            student_id: sub.student_id,
            student_name: (student as any).name || "طالب",
            student_code: (student as any).student_code || "—",
            student_phone: (student as any).student_phone || "",
            material_id: sub.material_id,
            quiz_title: material.title || "امتحان أونلاين",
            subject: material.description || materialQuestions.subject || "الفيزياء",
            quiz_number: materialQuestions.quiz_number || 1,
            group_id: (student as any).group_id || material.group_id || null,
            model: parsedNotes.model || "نموذج أ",
            exam_mode: parsedNotes.exam_mode || materialQuestions.exam_mode || "online",
            status: sub.status,
            is_graded: isGraded,
            has_essay: hasEssay,
            score: finalScore,
            total_score: finalScore,
            max_score: Number(parsedNotes.max_score || 10),
            percentage: Math.round(((finalScore || 0) / Number(parsedNotes.max_score || 10)) * 100),
            breakdown: Array.isArray(parsedNotes.breakdown) ? parsedNotes.breakdown : [],
            mcq_score: Number(parsedNotes.mcq_score || 0),
            total_mcq_points: Number(parsedNotes.total_mcq_points || 0),
            questions: materialQuestions.questions || [],
            answers: parsedNotes.answers || {},
            submitted_at: sub.submitted_at,
          };
        });

      try {
        const { data: legacySubRows } = await supabase
          .from("whatsapp_inbox")
          .select("message_body, phone, status, created_at, tenant_id")
          .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
          .like("phone", "QUIZ_SUB_%")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (Array.isArray(legacySubRows)) {
          for (const row of legacySubRows) {
            try {
              const parsed = typeof row.message_body === "string" ? JSON.parse(row.message_body) : row.message_body;
              if (parsed && (parsed.quiz_id || parsed.material_id)) {
                const subId = parsed.id || parsed.submission_id || (row as any).id;
                const alreadyExists = results.some((r: any) =>
                  r.id === subId || (String(r.student_code) === String(parsed.student_code) && String(r.material_id) === String(parsed.quiz_id || parsed.material_id))
                );
                if (!alreadyExists) {
                  results.push({
                    id: subId,
                    submission_id: subId,
                    student_id: parsed.student_id || parsed.student_code,
                    student_name: parsed.student_name || "طالب",
                    student_code: parsed.student_code || "—",
                    student_phone: parsed.student_phone || "",
                    material_id: parsed.material_id || parsed.quiz_id,
                    quiz_title: parsed.quiz_title || `كويز ${parsed.quiz_number || 1}`,
                    subject: parsed.subject || "الفيزياء",
                    quiz_number: Number(parsed.quiz_number) || 1,
                    group_id: parsed.group_id || null,
                    model: parsed.model || "نموذج أ",
                    exam_mode: parsed.exam_mode || (Array.isArray(parsed.breakdown) && parsed.breakdown.length > 0 ? "paper" : "online"),
                    status: parsed.status || "approved",
                    is_graded: true,
                    has_essay: Boolean(parsed.has_essay),
                    score: parsed.total_score !== undefined ? parsed.total_score : (parsed.score || 0),
                    total_score: parsed.total_score !== undefined ? parsed.total_score : (parsed.score || 0),
                    max_score: Number(parsed.max_score || 10),
                    percentage: parsed.percentage || Math.round(((parsed.total_score || parsed.score || 0) / Number(parsed.max_score || 10)) * 100),
                    breakdown: parsed.breakdown || [],
                    mcq_score: Number(parsed.mcq_score || 0),
                    total_mcq_points: Number(parsed.total_mcq_points || parsed.max_score || 10),
                    questions: parsed.questions || [],
                    answers: parsed.answers || {},
                    submitted_at: parsed.submitted_at || row.created_at,
                  });
                }
              }
            } catch (_) {}
          }
        }
      } catch (inboxErr) {
        console.warn("[Quizzes] Could not merge legacy whatsapp_inbox submissions:", inboxErr);
      }

      res.status(200).json({ success: true, submissions: results });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch online submissions";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-QUIZ.RICH-4: GET /api/quizzes/submissions/pending - List pending essay submissions
quizzesRouter.get(
  "/submissions/pending",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const groupId = (req.query.group_id as string) || "";

    try {
      const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();
      
      const { data: subs, error: subsError } = await supabase
        .from("homework_submissions")
        .select(`
          id,
          tenant_id,
          student_id,
          material_id,
          status,
          file_url,
          teacher_notes,
          submitted_at
        `)
        .eq("tenant_id", tenantId)
        .eq("status", "pending")
        .order("submitted_at", { ascending: false });

      if (subsError) throw subsError;

      if (!subs || subs.length === 0) {
        res.status(200).json({ success: true, submissions: [] });
        return;
      }

      const studentIds = [...new Set(subs.map((s: any) => s.student_id))];
      const materialIds = [...new Set(subs.map((s: any) => s.material_id))];

      const { data: studentsData } = await supabase
        .from("students")
        .select("id, name, student_code, group_id, student_phone")
        .in("id", studentIds);

      const { data: materialsData } = await supabase
        .from("study_materials")
        .select("id, title, description, questions, group_id")
        .in("id", materialIds);

      const studentMap = new Map((studentsData || []).map((s: any) => [s.id, s]));
      const materialMap = new Map((materialsData || []).map((m: any) => [m.id, m]));

      const results = subs
        .filter((sub: any) => {
          if (!groupId) return true;
          const s = studentMap.get(sub.student_id);
          const m = materialMap.get(sub.material_id);
          return (s && String(s.group_id) === String(groupId)) || (m && String(m.group_id) === String(groupId));
        })
        .map((sub: any) => {
          const student = studentMap.get(sub.student_id) || {};
          const material = materialMap.get(sub.material_id) || {};
          let parsedNotes: any = {};
          try {
            parsedNotes = typeof sub.teacher_notes === "string" ? JSON.parse(sub.teacher_notes) : (sub.teacher_notes || {});
          } catch (_) {
            parsedNotes = {};
          }

          let materialQuestions: any = {};
          try {
            materialQuestions = typeof material.questions === "string" ? JSON.parse(material.questions) : (material.questions || {});
          } catch (_) {
            materialQuestions = {};
          }

          return {
            id: sub.id,
            submission_id: sub.id,
            student_id: sub.student_id,
            student_name: (student as any).name || "طالب",
            student_code: (student as any).student_code || "—",
            student_phone: (student as any).student_phone || "",
            material_id: sub.material_id,
            quiz_title: material.title || "امتحان أونلاين",
            subject: material.description || materialQuestions.subject || "الفيزياء",
            quiz_number: materialQuestions.quiz_number || 1,
            questions: materialQuestions.questions || [],
            answers: parsedNotes.answers || {},
            mcq_score: Number(parsedNotes.mcq_score || 0),
            total_mcq_points: Number(parsedNotes.total_mcq_points || 0),
            submitted_at: sub.submitted_at,
          };
        });

      res.status(200).json({ success: true, submissions: results });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch pending submissions";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-QUIZ.RICH-5: POST /api/quizzes/submissions/grade-essay - Manually grade essay questions
quizzesRouter.post(
  "/submissions/grade-essay",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const {
      submission_id,
      student_id,
      quiz_number,
      group_id,
      essay_scores,
      notes,
    } = req.body;

    if (!submission_id || !student_id || quiz_number === undefined) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "submission_id, student_id and quiz_number are required" },
      });
      return;
    }

    try {
      const services = getServices(req);
      const quizzesService = services.quizzes;
      const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();

      const { data: sub, error: subErr } = await supabase
        .from("homework_submissions")
        .select("*")
        .eq("id", submission_id)
        .eq("tenant_id", tenantId)
        .single();

      if (subErr || !sub) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Submission not found" } });
        return;
      }

      let parsedNotes: any = {};
      try {
        parsedNotes = typeof sub.teacher_notes === "string" ? JSON.parse(sub.teacher_notes) : (sub.teacher_notes || {});
      } catch (_) {
        parsedNotes = {};
      }

      const mcqScore = Number(parsedNotes.mcq_score || 0);
      let essayTotal = 0;
      if (essay_scores && typeof essay_scores === "object") {
        for (const pts of Object.values(essay_scores)) {
          essayTotal += Number(pts || 0);
        }
      }

      const finalScore = mcqScore + essayTotal;
      const resolvedGroupId = group_id || parsedNotes.group_id || "default-group";
      const qNum = Number(quiz_number);

      await quizzesService.saveScores(tenantId, {
        group_id: resolvedGroupId,
        quiz_number: qNum,
        quiz_title: `كويز ${qNum}`,
        max_score: parsedNotes.max_score || 20,
        scores: {
          [student_id]: finalScore,
        },
        notes: {
          [student_id]: notes || `تم تصحيح المقالي: مقالي (${essayTotal}) + اختياري (${mcqScore})`,
        },
      });

      parsedNotes.essay_scores = essay_scores;
      parsedNotes.final_score = finalScore;
      parsedNotes.teacher_comment = notes || "";
      parsedNotes.graded_at = new Date().toISOString();

      await supabase
        .from("homework_submissions")
        .update({
          status: "approved",
          teacher_notes: JSON.stringify(parsedNotes),
        })
        .eq("id", submission_id);

      res.status(200).json({
        success: true,
        final_score: finalScore,
        mcq_score: mcqScore,
        essay_score: essayTotal,
        message: "تم اعتماد وتثبيت درجة الطالب بنجاح",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to grade essay";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-QUIZ.RICH-6: POST /api/quizzes/omr-scan - Record Bubble Sheet scan score
quizzesRouter.post(
  "/omr-scan",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // 1. Strict tenant authentication from session only
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "جلسة العمل غير موثقة (tenant_id مطلوب من الخادم)" },
      });
      return;
    }

    const { exam_id, group_id, quiz_number, student_code, student_id, model, barcode, serial, answers } = req.body;

    if ((!student_code && !student_id) || (quiz_number === undefined && !exam_id)) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "student_code (or student_id) and exam_id (or quiz_number) are required" },
      });
      return;
    }

    try {
      const services = getServices(req);
      const quizzesService = services.quizzes;
      const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();

      // 2. Strict Student Lookup & Group Membership Verification (No auto-attribution/invention of students)
      let studentQuery = supabase
        .from("students")
        .select("id, name, student_code, group_id, group_ids")
        .eq("tenant_id", tenantId);

      if (student_id) {
        studentQuery = studentQuery.eq("id", student_id);
      } else {
        studentQuery = studentQuery.eq("student_code", String(student_code).trim());
      }

      const { data: student, error: sErr } = await studentQuery.maybeSingle();

      if (!student) {
        res.status(404).json({
          error: { code: "STUDENT_NOT_FOUND", message: `كود الطالب (${student_code || student_id}) غير مسجل في النظام` },
        });
        return;
      }

      // Check that student belongs to the requested group if group_id is specified
      if (group_id && group_id !== "all") {
        const studentGid = String(student.group_id || "");
        const studentGids = Array.isArray(student.group_ids) ? student.group_ids.map((g: any) => String(g)) : [];
        const isMember = studentGid === String(group_id) || studentGids.includes(String(group_id));
        if (!isMember) {
          res.status(400).json({
            error: { code: "GROUP_MISMATCH", message: `الطالب (${student.name}) غير مسجل في هذه المجموعة` },
          });
          return;
        }
      }

      // 3. Resolve Target Exam Uniquely (Prevent collisions across groups/curriculums)
      let targetRow: any = null;
      if (exam_id) {
        const { data: row } = await supabase
          .from("study_materials")
          .select("id, group_id, questions, title")
          .eq("tenant_id", tenantId)
          .eq("id", exam_id)
          .in("type", ["online_quiz", "paper_quiz", "paper_exam"])
          .maybeSingle();
        targetRow = row;
      } else {
        let matQuery = supabase
          .from("study_materials")
          .select("id, group_id, questions, title")
          .eq("tenant_id", tenantId)
          .in("type", ["online_quiz", "paper_quiz", "paper_exam"]);

        if (group_id && group_id !== "all") {
          matQuery = matQuery.eq("group_id", group_id);
        }

        const { data: rows } = await matQuery;
        const matchingRows = (rows || []).filter((r: any) => {
          try {
            const p = JSON.parse(r.questions || "{}");
            return Number(p.quiz_number) === Number(quiz_number);
          } catch (_) {
            return false;
          }
        });

        if (matchingRows.length > 1) {
          res.status(400).json({
            error: {
              code: "AMBIGUOUS_EXAM",
              message: "يوجد أكثر من امتحان بنفس الرقم في هذه المجموعة. يرجى تمرير exam_id للتحديد الدقيق.",
            },
          });
          return;
        }
        targetRow = matchingRows[0];
      }

      if (!targetRow) {
        res.status(404).json({
          error: { code: "EXAM_NOT_FOUND", message: "تعذر العثور على سجل الامتحان المطلوب في هذه المجموعة" },
        });
        return;
      }

      // 4. Resolve Model Letter
      let resolvedModel = "أ";
      const codeToTest = (model || barcode || serial || "").toString().trim().toUpperCase();
      if (codeToTest.includes("B") || codeToTest.includes("ب") || codeToTest.endsWith("-02") || codeToTest.endsWith("-2") || codeToTest.includes("MOD-B")) {
        resolvedModel = "ب";
      } else if (codeToTest.includes("C") || codeToTest.includes("ج") || codeToTest.endsWith("-03") || codeToTest.endsWith("-3") || codeToTest.includes("MOD-C")) {
        resolvedModel = "ج";
      } else {
        resolvedModel = "أ";
      }

      // 5. Deterministic Stealth Model Permutation
      const parsedQuiz = JSON.parse(targetRow.questions || "{}");
      const quizQuestions = getStealthModelQuestions(parsedQuiz, resolvedModel);
      const totalMaxScore = quizQuestions.reduce((sum: number, q: any) => sum + Number(q.points || 1), 0) || 10;

      // 6. Score calculation against the resolved model answer key
      let calculatedScore = 0;
      const questionBreakdown: any[] = [];
      const studentAnswers = answers || {};

      if (quizQuestions.length === 0 && req.body.score !== undefined) {
        calculatedScore = Number(req.body.score);
      } else {
        quizQuestions.forEach((q: any, idx: number) => {
          const qNum = idx + 1;
          const studentChoice = studentAnswers[qNum] ?? studentAnswers[q.id];
          const isCorrect = studentChoice !== undefined && studentChoice !== null && Number(studentChoice) === Number(q.correct_index);
          const pts = isCorrect ? Number(q.points || 1) : 0;
          calculatedScore += pts;
          questionBreakdown.push({
            question_number: qNum,
            student_choice: studentChoice !== undefined ? studentChoice : null,
            correct_choice: q.correct_index,
            is_correct: isCorrect,
            points: pts,
            max_points: Number(q.points || 1),
          });
        });
      }

      const resolvedGroupId = group_id || targetRow.group_id || student.group_id || "default-group";
      const qNum = quiz_number !== undefined ? Number(quiz_number) : (Number(parsedQuiz.quiz_number) || 1);

      await quizzesService.saveScores(tenantId, {
        group_id: resolvedGroupId,
        quiz_number: qNum,
        quiz_title: targetRow.title || parsedQuiz.title || `كويز ${qNum}`,
        max_score: totalMaxScore,
        scores: {
          [student.id]: calculatedScore,
        },
        notes: {
          [student.id]: `تصحيح بابل شيت (نموذج ${resolvedModel})`,
        },
      });

      res.status(200).json({
        success: true,
        student: {
          id: student.id,
          name: student.name,
          code: student.student_code,
          group_id: resolvedGroupId,
        },
        exam: {
          id: targetRow.id,
          title: targetRow.title,
          quiz_number: qNum,
          model: resolvedModel,
        },
        score: calculatedScore,
        max_score: totalMaxScore,
        percentage: Math.round((calculatedScore / totalMaxScore) * 100),
        breakdown: questionBreakdown,
      });
    } catch (err: any) {
      const message = err?.message || "Failed to process OMR scan";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// POST /api/quizzes/upload-image - Upload question illustration / diagram / image
quizzesRouter.post(
  "/upload-image",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || "default";
    const { image_data } = req.body;

    if (!image_data || typeof image_data !== "string") {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "image_data is required" },
      });
      return;
    }

    try {
      const supabase = getServiceSupabaseClient();
      if (supabase && image_data.startsWith("data:image/")) {
        const matches = image_data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          const ext = contentType.split("/")[1] || "jpg";
          const path = `${tenantId}/quizzes/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("quiz-images")
            .upload(path, buffer, {
              contentType,
              upsert: true,
            });

          if (!uploadErr && uploadData) {
            const { data: urlData } = supabase.storage
              .from("quiz-images")
              .getPublicUrl(path);

            if (urlData?.publicUrl) {
              res.status(200).json({
                success: true,
                url: urlData.publicUrl,
              });
              return;
            }
          }
        }
      }

      res.status(200).json({
        success: true,
        url: image_data,
      });
    } catch (_) {
      res.status(200).json({
        success: true,
        url: image_data,
      });
    }
  }
);
