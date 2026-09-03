import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { validateBody, createGroupSchema, updateGroupSchema, enrollStudentSchema } from "../middleware/validation.js";

export const groupsRouter = Router();

// GET /api/groups - List all groups for current tenant
groupsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;

  try {
    let query = supabase
      .from("groups")
      .select("id, tenant_id, name, center_name, session_price, center_cut_percentage, teacher_cut_percentage, created_at")
      .order("name", { ascending: true });

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query;

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({ groups: data });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list groups" } });
  }
});

// POST /api/groups - Create a new group (validated with Zod)
groupsRouter.post(
  "/",
  validateBody(createGroupSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { name, center_name, session_price, center_cut_percentage, teacher_cut_percentage } = req.body;

    if (!tenantId && req.user!.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const calculatedTeacherCut = 
        teacher_cut_percentage !== undefined 
          ? teacher_cut_percentage 
          : 100 - (center_cut_percentage || 0);

      const { data, error } = await supabase
        .from("groups")
        .insert({
          tenant_id: tenantId,
          name,
          center_name: center_name || null,
          session_price: session_price || 0,
          center_cut_percentage: center_cut_percentage || 0,
          teacher_cut_percentage: calculatedTeacherCut,
        })
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
        return;
      }

      res.status(201).json({ group: data });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create group" } });
    }
  }
);

// GET /api/groups/:id - Get group details with enrolled students
groupsRouter.get("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id } = req.params;

  try {
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id, tenant_id, name, created_at")
      .eq("id", id)
      .single();

    if (groupError || !group) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Group not found" } });
      return;
    }

    const { data: enrollments, error: enrollError } = await supabase
      .from("group_students")
      .select("id, student_id, students(id, name, parent_phone, student_phone)")
      .eq("group_id", id);

    if (enrollError) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: enrollError.message } });
      return;
    }

    const students = (enrollments || []).map((e: any) => e.students);

    res.json({ group, students });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to retrieve group" } });
  }
});

// PUT /api/groups/:id - Update group name (validated with Zod)
groupsRouter.put(
  "/:id",
  validateBody(updateGroupSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const { id } = req.params;
    const { name } = req.body;

    try {
      const { data, error } = await supabase
        .from("groups")
        .update({ name })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
        return;
      }

      if (!data) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Group not found" } });
        return;
      }

      res.json({ group: data });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update group" } });
    }
  }
);

// DELETE /api/groups/:id - Delete group
groupsRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id } = req.params;

  try {
    const { error } = await supabase.from("groups").delete().eq("id", id);

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({ message: "Group deleted successfully", id });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete group" } });
  }
});

// POST /api/groups/:id/students - Enroll a student in a group (validated with Zod)
groupsRouter.post(
  "/:id/students",
  validateBody(enrollStudentSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { id: groupId } = req.params;
    const { student_id: studentId } = req.body;

    try {
      const { data, error } = await supabase
        .from("group_students")
        .insert({
          tenant_id: tenantId,
          group_id: groupId,
          student_id: studentId,
        })
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
        return;
      }

      res.status(201).json({ enrollment: data });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to enroll student" } });
    }
  }
);

// DELETE /api/groups/:id/students/:student_id - Remove student from group
groupsRouter.delete("/:id/students/:student_id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id: groupId, student_id: studentId } = req.params;

  try {
    const { error } = await supabase
      .from("group_students")
      .delete()
      .eq("group_id", groupId)
      .eq("student_id", studentId);

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({ message: "Student removed from group successfully", groupId, studentId });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to remove student from group" } });
  }
});
