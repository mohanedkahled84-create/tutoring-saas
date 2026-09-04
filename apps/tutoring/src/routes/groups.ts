import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import {
  validateBody,
  createGroupSchema,
  updateGroupSchema,
  enrollStudentSchema,
} from "../middleware/validation.js";
import { requireOwnerOrAdmin } from "../middleware/auth.js";
import { generateBarcodeSheetPdf } from "../features/students/index.js";

export const groupsRouter = Router();

// Helper to strip financial fields if user is assistant
function sanitizeGroupForRole(
  group: Record<string, unknown>,
  role: string
): Record<string, unknown> {
  if (role === "assistant") {
    const safeGroup = { ...group };
    delete safeGroup.price;
    delete safeGroup.billing_model;
    delete safeGroup.fixed_rent_amount;
    return safeGroup;
  }
  return group;
}

// GET /api/groups - List all groups for current tenant
groupsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;
  const role = req.user!.role;

  try {
    let query = supabase
      .from("groups")
      .select("id, tenant_id, name, price, billing_model, fixed_rent_amount, created_at")
      .order("name", { ascending: true });

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query;

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    const sanitized = (data || []).map((g) => sanitizeGroupForRole(g, role));
    res.json({ groups: sanitized });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list groups" } });
  }
});

// POST /api/groups - Create a new group (Owner or Admin only)
groupsRouter.post(
  "/",
  requireOwnerOrAdmin,
  validateBody(createGroupSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { name, price, billing_model, fixed_rent_amount } = req.body;

    if (!tenantId && req.user!.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("groups")
        .insert({
          tenant_id: tenantId,
          name,
          price: price || 0,
          billing_model: billing_model || "percentage",
          fixed_rent_amount: fixed_rent_amount || null,
        })
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
        return;
      }

      res.status(201).json({ group: data });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to create group" } });
    }
  }
);

// GET /api/groups/:id - Get group details with enrolled students
groupsRouter.get("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const { id } = req.params;
  const role = req.user!.role;

  try {
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id, tenant_id, name, price, billing_model, fixed_rent_amount, created_at")
      .eq("id", id)
      .single();

    if (groupError || !group) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Group not found" } });
      return;
    }

    const { data: enrollments, error: enrollError } = await supabase
      .from("group_students")
      .select(
        "id, student_id, students(id, name, parent_phone, student_phone, student_code, fee_override, exempt)"
      )
      .eq("group_id", id);

    if (enrollError) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: enrollError.message } });
      return;
    }

    const students = (enrollments || []).map((e: { students?: unknown }) => e.students);

    res.json({
      group: sanitizeGroupForRole(group, role),
      students,
    });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Failed to retrieve group" } });
  }
});

// PUT /api/groups/:id - Update group (Owner or Admin only)
groupsRouter.put(
  "/:id",
  requireOwnerOrAdmin,
  validateBody(updateGroupSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const { id } = req.params;
    const { name, price, billing_model, fixed_rent_amount } = req.body;

    try {
      const updatePayload: Record<string, unknown> = {};
      if (name !== undefined) updatePayload.name = name;
      if (price !== undefined) updatePayload.price = price;
      if (billing_model !== undefined) updatePayload.billing_model = billing_model;
      if (fixed_rent_amount !== undefined) updatePayload.fixed_rent_amount = fixed_rent_amount;

      const { data, error } = await supabase
        .from("groups")
        .update(updatePayload)
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
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to update group" } });
    }
  }
);

// DELETE /api/groups/:id - Delete group (Owner or Admin only)
groupsRouter.delete(
  "/:id",
  requireOwnerOrAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const { id } = req.params;

    try {
      const { error } = await supabase.from("groups").delete().eq("id", id);

      if (error) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
        return;
      }

      res.json({ message: "Group deleted successfully", id });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete group" } });
    }
  }
);

// POST /api/groups/:id/students - Enroll a student in a group
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
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to enroll student" } });
    }
  }
);

// DELETE /api/groups/:id/students/:student_id - Remove student from group
groupsRouter.delete(
  "/:id/students/:student_id",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    } catch (err: unknown) {
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to remove student from group" },
      });
    }
  }
);

// DEV-QP.1: GET /api/groups/:id/barcode-sheet - Generate printable A4 PDF barcode sheet
groupsRouter.get(
  "/:id/barcode-sheet",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const { id: groupId } = req.params;

    try {
      const { data: group, error: groupErr } = await supabase
        .from("groups")
        .select("id, name, center_name")
        .eq("id", groupId)
        .single();

      if (groupErr || !group) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Group not found" } });
        return;
      }

      const { data: enrollments, error: enrollErr } = await supabase
        .from("group_students")
        .select("student_id, students(id, name, student_code)")
        .eq("group_id", groupId);

      if (enrollErr) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: enrollErr.message } });
        return;
      }

      const rawEnrollments = (enrollments || []) as unknown as Array<{
        students?: { id: string; name: string; student_code?: string } | null;
      }>;

      const students = rawEnrollments
        .map((e) => e.students)
        .filter((s): s is { id: string; name: string; student_code?: string } => Boolean(s))
        .map((s, idx: number) => ({
          id: s.id,
          name: s.name,
          student_code: s.student_code || String(1001 + idx),
        }));

      if (students.length === 0) {
        res.status(400).json({
          error: {
            code: "NO_STUDENTS",
            message: "This group does not have any enrolled students yet.",
          },
        });
        return;
      }

      const pdfBuffer = await generateBarcodeSheetPdf({
        group_name: group.name,
        students,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="group-${groupId}-barcodes.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to generate barcode sheet" } });
    }
  }
);
