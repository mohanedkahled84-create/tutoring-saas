import { Router, Request, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { verifyParentPortalToken } from "../../shared/utils/tokens.js";
import { logger } from "../../shared/utils/logger.js";

export const homeworkRouter = Router();
export const publicHomeworkRouter = Router();

// Validation Schemas
const submitHomeworkSchema = z.object({
  token: z.string().min(1, "Token is required"),
  material_id: z.string().uuid("Invalid material_id"),
  file_url: z.string().url("Invalid file_url").optional(),
  file_data: z.string().optional(),
  file_name: z.string().optional(),
  file_size: z.number().optional(),
}).refine((data) => data.file_url || data.file_data, {
  message: "يجب توفير ملف الواجب (file_data أو file_url)",
});

const reviewHomeworkSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  teacher_notes: z.string().optional(),
});

/**
 * Public Endpoint: POST /api/public/homework/submit
 * Student uploads/submits their homework PDF
 */
publicHomeworkRouter.post("/submit", async (req: Request, res: Response): Promise<void> => {
  const parsed = submitHomeworkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } });
    return;
  }

  const { token, material_id, file_name, file_size } = parsed.data;
  let file_url = parsed.data.file_url;
  const file_data = parsed.data.file_data;
  const supabase = getServiceSupabaseClient();

  try {
    // 1. Resolve student by token
    const verified = verifyParentPortalToken(token);
    let studentId = verified?.student_id || null;
    let tenantId = verified?.tenant_id || null;

    if (!studentId || !tenantId) {
      const { data: student } = await supabase
        .from("students")
        .select("id, tenant_id")
        .eq("parent_portal_token", token)
        .maybeSingle();

      if (!student) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "رابط الطالب غير صالح أو منتهي الصلاحية" } });
        return;
      }
      studentId = student.id;
      tenantId = student.tenant_id;
    }

    // 2. Verify material belongs to same tenant
    const { data: material } = await supabase
      .from("study_materials")
      .select("id, tenant_id, title, is_homework")
      .eq("id", material_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!material) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "الواجب غير موجود أو لا ينتمي لنفس المعلم" } });
      return;
    }

    // 3. If base64 file_data provided, upload directly to Supabase Storage bucket 'homework-submissions'
    if (file_data) {
      const base64Clean = file_data.replace(/^data:application\/pdf;base64,/, "").replace(/^data:.*;base64,/, "");
      const fileBuffer = Buffer.from(base64Clean, "base64");
      const cleanFileName = (file_name || "homework.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${tenantId}/${material_id}/${studentId}_${Date.now()}_${cleanFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("homework-submissions")
        .upload(storagePath, fileBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        logger.error(`[Homework] Storage upload error: ${uploadError.message}`);
        res.status(500).json({ error: { code: "STORAGE_ERROR", message: "تعذر حفظ ملف الـ PDF في السحابة" } });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("homework-submissions")
        .getPublicUrl(storagePath);

      file_url = publicUrlData.publicUrl;
    }

    if (!file_url) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "تعذر استخراج رابط ملف الواجب" } });
      return;
    }

    // 4. Upsert submission record
    const { data: submission, error: submitErr } = await supabase
      .from("homework_submissions")
      .upsert(
        {
          tenant_id: tenantId,
          material_id: material_id,
          student_id: studentId,
          file_url,
          file_name: file_name || "homework.pdf",
          file_size: file_size || 0,
          status: "pending",
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "material_id,student_id" }
      )
      .select("*")
      .single();

    if (submitErr) {
      logger.error(`[Homework] Submit error: ${submitErr.message}`);
      res.status(500).json({ error: { code: "DB_ERROR", message: "فشل حفظ بيانات الواجب" } });
      return;
    }

    res.json({ success: true, submission });
  } catch (err) {
    logger.error(`[Homework] Submit exception: ${(err as Error).message}`);
    res.status(500).json({ error: { code: "SERVER_ERROR", message: "حدث خطأ غير متوقع" } });
  }
});

/**
 * Protected Endpoint: GET /api/homework/submissions
 * Lists submissions, split into submitted (مين سلّم) vs missing (مين لسه)
 */
homeworkRouter.get("/submissions", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Tenant ID required" } });
    return;
  }

  const requestedMaterialId = req.query.material_id as string | undefined;
  const requestedGroupId = req.query.group_id as string | undefined;
  const supabase = getServiceSupabaseClient();

  try {
    // 1. Fetch all active homework assignments for this teacher/tenant
    let materialsQuery = supabase
      .from("study_materials")
      .select("id, title, description, group_id, due_date, created_at")
      .eq("tenant_id", tenantId)
      .eq("is_homework", true)
      .order("created_at", { ascending: false });

    if (requestedGroupId && requestedGroupId !== "all") {
      materialsQuery = materialsQuery.or(`group_id.eq.${requestedGroupId},group_id.is.null`);
    }

    const { data: homeworkList, error: hwErr } = await materialsQuery;
    if (hwErr) {
      res.status(500).json({ error: { code: "DB_ERROR", message: hwErr.message } });
      return;
    }

    const assignments: any[] = homeworkList || [];
    if (assignments.length === 0) {
      res.json({
        assignments: [],
        current_homework: null,
        submitted: [],
        missing: [],
      });
      return;
    }

    // Determine current selected homework
    const currentHomework = requestedMaterialId
      ? assignments.find((h: any) => h.id === requestedMaterialId) || assignments[0]
      : assignments[0];

    // 2. Fetch all submissions for current homework
    const { data: submissions, error: subErr } = await supabase
      .from("homework_submissions")
      .select("id, material_id, student_id, file_url, file_name, file_size, status, teacher_notes, submitted_at, reviewed_at, students(id, name, code, student_code, phone, parent_phone, group_id)")
      .eq("material_id", currentHomework.id)
      .order("submitted_at", { ascending: false });

    if (subErr) {
      res.status(500).json({ error: { code: "DB_ERROR", message: subErr.message } });
      return;
    }

    const submittedStudentsMap = new Set((submissions || []).map((s: any) => s.student_id));

    // 3. Fetch all enrolled students eligible for this homework
    let studentsQuery = supabase
      .from("students")
      .select("id, name, code, student_code, phone, parent_phone, group_id")
      .eq("tenant_id", tenantId);

    if (currentHomework.group_id) {
      studentsQuery = studentsQuery.eq("group_id", currentHomework.group_id);
    } else if (requestedGroupId && requestedGroupId !== "all") {
      studentsQuery = studentsQuery.eq("group_id", requestedGroupId);
    }

    const { data: allEligibleStudents } = await studentsQuery;
    const eligibleStudents: any[] = allEligibleStudents || [];

    // Missing students: enrolled but not in submittedStudentsMap
    const missing = eligibleStudents
      .filter((s: any) => !submittedStudentsMap.has(s.id))
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        code: s.code || s.student_code || "—",
        phone: s.phone || s.parent_phone || "",
        group_id: s.group_id,
      }));

    // Formatted submitted students list
    const submitted = (submissions || []).map((sub: any) => ({
      id: sub.id,
      student_id: sub.student_id,
      student_name: sub.students?.name || "طالب",
      student_code: sub.students?.code || sub.students?.student_code || "—",
      student_phone: sub.students?.phone || sub.students?.parent_phone || "",
      file_url: sub.file_url,
      file_name: sub.file_name,
      status: sub.status,
      teacher_notes: sub.teacher_notes,
      submitted_at: sub.submitted_at,
      reviewed_at: sub.reviewed_at,
    }));

    res.json({
      assignments,
      current_homework: currentHomework,
      submitted,
      missing,
    });
  } catch (err) {
    logger.error(`[Homework] List error: ${(err as Error).message}`);
    res.status(500).json({ error: { code: "SERVER_ERROR", message: "فشل جلب قائمة الواجبات" } });
  }
});

/**
 * Protected Endpoint: PUT /api/homework/submissions/:id/review
 * Teacher approves or rejects a student's homework submission
 */
homeworkRouter.put("/submissions/:id/review", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = reviewHomeworkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } });
    return;
  }

  const submissionId = req.params.id;
  const { status, teacher_notes } = parsed.data;
  const tenantId = req.user?.tenant_id;
  const reviewerId = req.user?.id;
  const supabase = getServiceSupabaseClient();

  try {
    const { data: updated, error } = await supabase
      .from("homework_submissions")
      .update({
        status,
        teacher_notes: teacher_notes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId || null,
      })
      .eq("id", submissionId)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();

    if (error) {
      res.status(500).json({ error: { code: "DB_ERROR", message: error.message } });
      return;
    }

    res.json({ success: true, submission: updated });
  } catch (err) {
    res.status(500).json({ error: { code: "SERVER_ERROR", message: "فشل تحديث حالة مراجعة الواجب" } });
  }
});
