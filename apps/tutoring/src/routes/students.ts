import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { validateBody, createStudentSchema, updateStudentSchema, publicSelfRegisterSchema } from "../middleware/validation.js";

export const studentsRouter = Router();

// GET /api/students - List all students for current tenant
studentsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;
  const { q } = req.query;

  try {
    let query = supabase
      .from("students")
      .select("id, tenant_id, code, name, parent_phone, student_phone, notes, created_at")
      .order("created_at", { ascending: false });

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    if (q && typeof q === "string") {
      query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,parent_phone.ilike.%${q}%,student_phone.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({ students: data });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list students" } });
  }
});

// POST /api/students - Create a new student (validated with Zod)
studentsRouter.post(
  "/",
  validateBody(createStudentSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { name, parent_phone, student_phone, code, notes } = req.body;

    if (!tenantId && req.user!.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("students")
        .insert({
          tenant_id: tenantId,
          name,
          parent_phone,
          student_phone: student_phone || null,
          code: code || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
        return;
      }

      res.status(201).json({ student: data });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create student" } });
    }
  }
);

// GET /api/students/:id - Get a single student
studentsRouter.get("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("students")
      .select("id, tenant_id, name, parent_phone, student_phone, notes, created_at")
      .eq("id", id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found" } });
      return;
    }

    res.json({ student: data });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to retrieve student" } });
  }
});

// PUT /api/students/:id - Update student (validated with Zod)
studentsRouter.put(
  "/:id",
  validateBody(updateStudentSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const { id } = req.params;
    const { name, parent_phone, student_phone, notes } = req.body;

    try {
      const updatePayload: Record<string, any> = {};
      if (name !== undefined) updatePayload.name = name;
      if (parent_phone !== undefined) updatePayload.parent_phone = parent_phone;
      if (student_phone !== undefined) updatePayload.student_phone = student_phone;
      if (notes !== undefined) updatePayload.notes = notes;

      const { data, error } = await supabase
        .from("students")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
        return;
      }

      if (!data) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found" } });
        return;
      }

      res.json({ student: data });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update student" } });
    }
  }
);

// DELETE /api/students/:id - Delete student
studentsRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id } = req.params;

  try {
    const { error } = await supabase.from("students").delete().eq("id", id);

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({ message: "Student deleted successfully", id });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete student" } });
  }
});

// POST /api/students/public-register - Public Self-Registration Form
studentsRouter.post(
  "/public-register",
  validateBody(publicSelfRegisterSchema),
  async (req: any, res: Response): Promise<void> => {
    const supabase = req.supabase!;
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
        message: "Student registered successfully",
        student,
        verification_message_queued: true,
      });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Self-registration failed" } });
    }
  }
);
