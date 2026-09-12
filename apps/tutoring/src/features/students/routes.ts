import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServices } from "../../composition.js";
import {
  validateBody,
  createStudentSchema,
  updateStudentSchema,
  publicSelfRegisterSchema,
} from "../../shared/middleware/validation.js";
import { generateParentPortalToken } from "../../shared/utils/tokens.js";

export const studentsRouter = Router();
export const importRouter = Router();

// GET /api/students - List all students for current tenant
studentsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id || undefined;
  const { q, group_id } = req.query;

  try {
    const studentsService = getServices(req).students;
    const students = await studentsService.listStudents(
      tenantId,
      typeof q === "string" ? q : undefined,
      typeof group_id === "string" ? group_id : undefined
    );
    res.json({ students });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list students";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// POST /api/students - Create a new student (validated with Zod)
studentsRouter.post(
  "/",
  validateBody(createStudentSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || undefined;
    const userRole = req.user?.role;

    try {
      const studentsService = getServices(req).students;
      const student = await studentsService.createStudent(tenantId, req.body, userRole);
      res.status(201).json({ student });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "NO_TENANT_CONTEXT") {
        res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to create student";
      res.status(400).json({ error: { code: "BAD_REQUEST", message } });
    }
  }
);

// GET /api/students/:id - Get a single student
studentsRouter.get("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const studentsService = getServices(req).students;
    const student = await studentsService.getStudent(id);

    if (!student) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found" } });
      return;
    }

    res.json({ student });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve student";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// PUT /api/students/:id - Update student (validated with Zod)
studentsRouter.put(
  "/:id",
  validateBody(updateStudentSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const studentsService = getServices(req).students;
      const student = await studentsService.updateStudent(id, req.body);

      if (!student) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found" } });
        return;
      }

      res.json({ student });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update student";
      res.status(400).json({ error: { code: "BAD_REQUEST", message } });
    }
  }
);

// DEV-34: GET /api/students/:id/parent-link - Generate signed parent portal link
studentsRouter.get("/:id/parent-link", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id: studentId } = req.params;

  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const studentsService = getServices(req).students;
    const student = await studentsService.getStudent(studentId);
    if (!student) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found" } });
      return;
    }

    let token = student.parent_portal_token;
    if (!token) {
      token = generateParentPortalToken(studentId, tenantId || "default", 365);
      await studentsService.updateStudent(studentId, { parent_portal_token: token }).catch(() => {});
    }

    const canonicalOrigin = process.env.PUBLIC_APP_URL || "https://centerly-platform.vercel.app";
    const portalUrl = `/parent-portal?token=${token}`;
    const fullUrl = `${canonicalOrigin}${portalUrl}`;

    res.json({
      student_id: studentId,
      token,
      portal_url: portalUrl,
      full_url: fullUrl,
      parent_portal_sent_at: student.parent_portal_sent_at || null,
      expires_in_days: 365,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});

// DEV-PORTAL.1: POST /api/students/:id/send-parent-link - Dispatch parent portal link via WhatsApp
studentsRouter.post("/:id/send-parent-link", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id: studentId } = req.params;
  const { teacher_id, teacher_name } = req.body || {};

  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const studentsService = getServices(req).students;
    const student = await studentsService.getStudent(studentId);

    if (!student) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found" } });
      return;
    }

    const parentPhone = (student.parent_phone || "").trim();
    if (!parentPhone) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "رقم هاتف ولي الأمر غير متوفر لهذا الطالب" } });
      return;
    }

    let token = student.parent_portal_token;
    if (!token) {
      token = generateParentPortalToken(student.id, tenantId || "default", 365);
    }

    const canonicalOrigin = process.env.PUBLIC_APP_URL || "https://centerly-platform.vercel.app";
    const portalUrl = `${canonicalOrigin}/parent-portal?token=${token}`;

    const whatsAppService = getServices(req).whatsapp;
    const result = await whatsAppService.sendParentPortalLink({
      tenant_id: tenantId || "default",
      teacher_id: teacher_id || req.user?.id || null,
      student_id: student.id,
      student_name: student.name,
      parent_phone: parentPhone,
      teacher_name: teacher_name || (req.user as any)?.name,
      portal_url: portalUrl,
    });

    if (result.success) {
      const now = new Date().toISOString();
      await studentsService.updateStudent(student.id, {
        parent_portal_sent_at: now,
        parent_portal_token: token,
      });

      res.json({
        success: true,
        portal_url: portalUrl,
        sent_at: now,
        recipient: result.recipient,
        message_text: result.message_text,
      });
    } else {
      res.status(502).json({
        success: false,
        error: result.error || "فشل إرسال الرابط عبر بوابة واتساب",
      });
    }
  } catch (err: unknown) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: (err as Error).message },
    });
  }
});

// DEV-PORTAL.2: POST /api/students/batch-send-parent-links - Batch dispatch to new/unsent students
studentsRouter.post("/batch-send-parent-links", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { student_ids, teacher_id, teacher_name, pacing_delay_ms } = req.body || {};

  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const studentsService = getServices(req).students;
    const allStudents = await studentsService.listStudents(tenantId || undefined);

    // Target either explicitly passed IDs or all students with parent_portal_sent_at === null
    const targetStudents = (allStudents || []).filter((s) => {
      const hasPhone = !!(s.parent_phone && s.parent_phone.trim());
      if (!hasPhone) return false;
      if (Array.isArray(student_ids) && student_ids.length > 0) {
        return student_ids.includes(s.id);
      }
      return !s.parent_portal_sent_at;
    });

    if (targetStudents.length === 0) {
      res.json({
        total: 0,
        sent_count: 0,
        failed_count: 0,
        message: "جميع الطلاب المستهدفين تم إرسال الروابط لهم مسبقاً",
        results: [],
      });
      return;
    }

    const canonicalOrigin = process.env.PUBLIC_APP_URL || "https://centerly-platform.vercel.app";
    const studentsPayload = targetStudents.map((s) => {
      let token = s.parent_portal_token;
      if (!token) {
        token = generateParentPortalToken(s.id, tenantId || "default", 365);
      }
      return {
        student_id: s.id,
        student_name: s.name,
        parent_phone: s.parent_phone,
        portal_url: `${canonicalOrigin}/parent-portal?token=${token}`,
        token,
      };
    });

    const whatsAppService = getServices(req).whatsapp;
    const batchRes = await whatsAppService.batchSendParentPortalLinks({
      tenant_id: tenantId || "default",
      teacher_id: teacher_id || req.user?.id || null,
      teacher_name: teacher_name || (req.user as any)?.name,
      students: studentsPayload,
      pacingDelayMs: pacing_delay_ms,
    });

    // Mark successfully sent students in database
    const now = new Date().toISOString();
    for (const r of batchRes.results) {
      if (r.status === "sent") {
        const item = studentsPayload.find((p) => p.student_id === r.student_id);
        await studentsService.updateStudent(r.student_id, {
          parent_portal_sent_at: now,
          parent_portal_token: item?.token,
        }).catch(() => {});
      }
    }

    res.json({
      total: batchRes.total,
      sent_count: batchRes.sent_count,
      failed_count: batchRes.failed_count,
      results: batchRes.results,
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: (err as Error).message },
    });
  }
});

// DEV-QUIZ.1: POST /api/students/:id/notify-score - Send quiz score via WhatsApp
studentsRouter.post("/:id/notify-score", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id: studentId } = req.params;
  const { score, max_score, quiz_title, teacher_id, teacher_name, note, custom_message } = req.body;

  if (score === undefined || score === null || score === "") {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "score is required" } });
    return;
  }

  try {
    const studentsService = getServices(req).students;
    const student = await studentsService.getStudent(studentId);

    if (!student) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found" } });
      return;
    }

    const target = req.body.target || req.body.recipient_type || "both";
    const parentPhone = (student.parent_phone || "").trim();
    const studentPhone = (student.student_phone || (student as any).phone || "").trim();

    if (target === "parent" && !parentPhone) {
      res.status(400).json({
        error: { code: "NO_PARENT_PHONE", message: "Student has no parent phone registered" },
      });
      return;
    }

    if (target === "student" && !studentPhone) {
      res.status(400).json({
        error: { code: "NO_STUDENT_PHONE", message: "Student has no student phone registered" },
      });
      return;
    }

    if (!parentPhone && !studentPhone) {
      res.status(400).json({
        error: { code: "NO_PHONE_NUMBER", message: "Student has neither parent phone nor student phone registered" },
      });
      return;
    }

    const whatsAppService = getServices(req).whatsapp;
    const resolvedTeacherId =
      teacher_id ||
      req.user?.teacher_id ||
      (req.user?.role === "teacher" ? req.user?.id : "default");

    const result = await whatsAppService.sendQuizScore({
      tenant_id: tenantId || student.tenant_id || "default",
      teacher_id: resolvedTeacherId,
      student_id: student.id,
      student_name: student.name,
      parent_phone: parentPhone,
      student_phone: studentPhone,
      recipient_type: target as ("parent" | "student" | "both"),
      quiz_title: quiz_title || "الكويز",
      score: Number(score),
      max_score: max_score ? Number(max_score) : 10,
      teacher_name,
      note,
      custom_message,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: { code: "SEND_FAILED", message: result.error },
        message_text: result.message_text,
        parent_phone: student.parent_phone,
        student_phone: studentPhone,
        student_name: student.name,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Quiz score sent successfully",
      student_name: student.name,
      parent_phone: student.parent_phone,
      student_phone: studentPhone,
      sent_to: result.sent_to,
      message_text: result.message_text,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send quiz score";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// DELETE /api/students/:id - Delete student
studentsRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const studentsService = getServices(req).students;
    await studentsService.deleteStudent(id);
    res.json({ message: "Student deleted successfully", id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete student";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// POST /api/students/public-register - Public Self-Registration Form
studentsRouter.post(
  "/public-register",
  validateBody(publicSelfRegisterSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const studentsService = getServices(req).students;
      const result = await studentsService.publicRegister(req.body);

      res.status(201).json({
        message: "Student registered successfully",
        student: result.student,
        verification_message_queued: result.verification_message_queued,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Self-registration failed";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-BSI.1: POST /api/groups/:id/students/import
importRouter.post(
  "/:id/students/import",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || undefined;
    const userRole = req.user?.role;
    const { id: groupId } = req.params;
    const { rows, csv_content, column_mapping } = req.body;

    try {
      const studentsService = getServices(req).students;
      const result = await studentsService.bulkImport(
        tenantId,
        groupId,
        { rows, csv_content, column_mapping },
        userRole
      );

      res.status(200).json(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "NO_TENANT_CONTEXT") {
          res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
          return;
        }
        if (err.message === "GROUP_NOT_FOUND") {
          res.status(404).json({ error: { code: "NOT_FOUND", message: "Target group not found" } });
          return;
        }
        if (err.message === "EMPTY_PAYLOAD") {
          res.status(400).json({
            error: {
              code: "BAD_REQUEST",
              message: "Either 'rows' array or 'csv_content' text must be provided",
            },
          });
          return;
        }
        if (err.message === "NO_DATA_ROWS") {
          res.status(400).json({
            error: { code: "BAD_REQUEST", message: "Import payload contains no data rows" },
          });
          return;
        }
      }

      const message = err instanceof Error ? err.message : "Bulk import execution failed";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);
