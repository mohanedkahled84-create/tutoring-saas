import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServices } from "../../composition.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { config } from "../../shared/config/index.js";
import { validateFileUpload } from "../../shared/utils/fileUploadValidator.js";

export const quizzesRouter = Router();

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
        .eq("type", "online_quiz")
        .order("created_at", { ascending: false });

      if (groupId) {
        query = query.or(`group_id.eq.${groupId},group_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const richQuizzes = (data || []).map((row: any) => {
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

      res.status(200).json({ success: true, quizzes: richQuizzes });
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
    } = req.body;

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
      const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();

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
        const { data, error } = await supabase
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
          .single();

        if (error) throw error;
        materialRecord = data;
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
            return Number(p.quiz_number) === qNum;
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

      res.status(200).json({
        success: true,
        quiz: {
          id: materialRecord.id,
          title: cleanTitle,
          subject: cleanSubject,
          group_id,
          quiz_number: qNum,
          time_limit_minutes: cleanTimeLimit,
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
        .eq("status", "needs_grading")
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
    const tenantId = req.user?.tenant_id || "default";
    const { group_id, quiz_number, student_code, model, barcode, serial, answers } = req.body;

    if (!student_code || quiz_number === undefined) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "student_code and quiz_number are required" },
      });
      return;
    }

    try {
      const services = getServices(req);
      const quizzesService = services.quizzes;
      const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();

      // Stealth model resolution from barcode/serial
      let resolvedModel = model || "أ";
      const codeToTest = (barcode || serial || "").toString().trim().toUpperCase();
      if (codeToTest.endsWith("-01") || codeToTest.endsWith("-1") || codeToTest.includes("MOD-A")) {
        resolvedModel = "أ";
      } else if (codeToTest.endsWith("-02") || codeToTest.endsWith("-2") || codeToTest.includes("MOD-B")) {
        resolvedModel = "ب";
      } else if (codeToTest.endsWith("-03") || codeToTest.endsWith("-3") || codeToTest.includes("MOD-C")) {
        resolvedModel = "ج";
      }

      const { data: student, error: sErr } = await supabase
        .from("students")
        .select("id, name, student_code, group_id")
        .eq("tenant_id", tenantId)
        .eq("student_code", String(student_code).trim())
        .maybeSingle();

      if (sErr || !student) {
        res.status(404).json({ error: { code: "STUDENT_NOT_FOUND", message: `لم يتم العثور على طالب بالكود (${student_code})` } });
        return;
      }

      const { data: existingRows } = await supabase
        .from("study_materials")
        .select("questions")
        .eq("tenant_id", tenantId)
        .eq("type", "online_quiz");

      let quizQuestions: any[] = [];
      let totalMaxScore = 10;
      for (const row of existingRows || []) {
        try {
          const p = JSON.parse(row.questions || "{}");
          if (Number(p.quiz_number) === Number(quiz_number)) {
            // Check if stealth_models exist for the resolved model
            if (p.stealth_models && p.stealth_models[resolvedModel]) {
              quizQuestions = p.stealth_models[resolvedModel].questions || p.questions || [];
            } else {
              quizQuestions = p.questions || [];
            }
            totalMaxScore = quizQuestions.reduce((sum: number, q: any) => sum + Number(q.points || 1), 0) || 10;
            break;
          }
        } catch (_) {}
      }

      let calculatedScore = 0;
      const questionBreakdown: any[] = [];
      const studentAnswers = answers || {};

      quizQuestions.forEach((q: any, idx: number) => {
        const qNum = idx + 1;
        const studentChoice = studentAnswers[qNum] ?? studentAnswers[q.id];
        const isCorrect = Number(studentChoice) === Number(q.correct_index);
        const pts = isCorrect ? Number(q.points || 1) : 0;
        calculatedScore += pts;
        questionBreakdown.push({
          question_number: qNum,
          student_choice: studentChoice,
          correct_choice: q.correct_index,
          is_correct: isCorrect,
          points: pts,
          max_points: Number(q.points || 1),
        });
      });

      const resolvedGroupId = group_id || student.group_id || "default-group";
      await quizzesService.saveScores(tenantId, {
        group_id: resolvedGroupId,
        quiz_number: Number(quiz_number),
        quiz_title: `كويز ${quiz_number}`,
        max_score: totalMaxScore,
        scores: {
          [student.id]: calculatedScore,
        },
        notes: {
          [student.id]: `تصحيح بابل شيت (نموذج ${resolvedModel} - باركود تلقائي)`,
        },
      });

      res.status(200).json({
        success: true,
        student: {
          id: student.id,
          name: student.name,
          code: student.student_code,
        },
        score: calculatedScore,
        max_score: totalMaxScore,
        model: resolvedModel || "أ",
        breakdown: questionBreakdown,
        message: `تم رصد درجة الطالب ${student.name}: (${calculatedScore} / ${totalMaxScore}) بنجاح!`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to process OMR scan";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);
