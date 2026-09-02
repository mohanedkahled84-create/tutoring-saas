import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";

export const groupsRouter = Router();

// GET /api/groups - List all groups for current tenant
groupsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;

  try {
    let query = supabase
      .from("groups")
      .select("id, tenant_id, name, created_at")
      .order("name", { ascending: true });

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ groups: data });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list groups", details: err.message });
  }
});

// POST /api/groups - Create a new group
groupsRouter.post("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ error: "Group name is required" });
    return;
  }

  if (!tenantId && req.user!.role !== "admin") {
    res.status(403).json({ error: "No active tenant context" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("groups")
      .insert({
        tenant_id: tenantId,
        name,
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ group: data });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create group", details: err.message });
  }
});

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
      res.status(404).json({ error: "Group not found" });
      return;
    }

    // Fetch enrolled students
    const { data: enrollments, error: enrollError } = await supabase
      .from("group_students")
      .select("id, student_id, students(id, name, parent_phone, student_phone)")
      .eq("group_id", id);

    if (enrollError) {
      res.status(400).json({ error: enrollError.message });
      return;
    }

    const students = (enrollments || []).map((e: any) => e.students);

    res.json({ group, students });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve group", details: err.message });
  }
});

// PUT /api/groups/:id - Update group name
groupsRouter.put("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ error: "Group name is required" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("groups")
      .update({ name })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    res.json({ group: data });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update group", details: err.message });
  }
});

// DELETE /api/groups/:id - Delete group
groupsRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from("groups")
      .delete()
      .eq("id", id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: "Group deleted successfully", id });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete group", details: err.message });
  }
});

// POST /api/groups/:id/students - Enroll a student in a group
groupsRouter.post("/:id/students", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;
  const { id: groupId } = req.params;
  const { student_id: studentId } = req.body;

  if (!studentId) {
    res.status(400).json({ error: "student_id is required" });
    return;
  }

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
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ enrollment: data });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to enroll student", details: err.message });
  }
});

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
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: "Student removed from group successfully", groupId, studentId });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to remove student from group", details: err.message });
  }
});
