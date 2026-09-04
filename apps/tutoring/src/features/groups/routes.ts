import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServices } from "../../composition.js";
import {
  validateBody,
  createGroupSchema,
  updateGroupSchema,
  enrollStudentSchema,
} from "../../shared/middleware/validation.js";
import { requireOwnerOrAdmin } from "../../shared/middleware/auth.js";
import { generateBarcodeSheetPdf } from "../students/index.js";

export const groupsRouter = Router();

// GET /api/groups - List all groups for current tenant
groupsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id || undefined;
  const role = req.user?.role;

  try {
    const groupsService = getServices(req).groups;
    const groups = await groupsService.listGroups(tenantId, role);
    res.json({ groups });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list groups";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// POST /api/groups - Create a new group (Owner or Admin only)
groupsRouter.post(
  "/",
  requireOwnerOrAdmin,
  validateBody(createGroupSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || undefined;
    const role = req.user?.role;

    try {
      const groupsService = getServices(req).groups;
      const group = await groupsService.createGroup(tenantId, req.body, role);
      res.status(201).json({ group });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "NO_TENANT_CONTEXT") {
        res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to create group";
      res.status(400).json({ error: { code: "BAD_REQUEST", message } });
    }
  }
);

// GET /api/groups/:id - Get group details with enrolled students
groupsRouter.get("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const role = req.user?.role;

  try {
    const groupsService = getServices(req).groups;
    const result = await groupsService.getGroup(id, role);

    if (!result) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Group not found" } });
      return;
    }

    res.json({
      group: result.group,
      students: result.students,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve group";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});

// PUT /api/groups/:id - Update group (Owner or Admin only)
groupsRouter.put(
  "/:id",
  requireOwnerOrAdmin,
  validateBody(updateGroupSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const groupsService = getServices(req).groups;
      const group = await groupsService.updateGroup(id, req.body);

      if (!group) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Group not found" } });
        return;
      }

      res.json({ group });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update group";
      res.status(400).json({ error: { code: "BAD_REQUEST", message } });
    }
  }
);

// DELETE /api/groups/:id - Delete group (Owner or Admin only)
groupsRouter.delete(
  "/:id",
  requireOwnerOrAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const groupsService = getServices(req).groups;
      await groupsService.deleteGroup(id);
      res.json({ message: "Group deleted successfully", id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete group";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// POST /api/groups/:id/students - Enroll a student in a group
groupsRouter.post(
  "/:id/students",
  validateBody(enrollStudentSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id || undefined;
    const { id: groupId } = req.params;
    const { student_id: studentId } = req.body;

    try {
      const groupsService = getServices(req).groups;
      const enrollment = await groupsService.enrollStudent(tenantId, groupId, studentId);
      res.status(201).json({ enrollment });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to enroll student";
      res.status(400).json({ error: { code: "BAD_REQUEST", message } });
    }
  }
);

// DELETE /api/groups/:id/students/:student_id - Remove student from group
groupsRouter.delete(
  "/:id/students/:student_id",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id: groupId, student_id: studentId } = req.params;

    try {
      const groupsService = getServices(req).groups;
      await groupsService.removeStudent(groupId, studentId);
      res.json({ message: "Student removed from group successfully", groupId, studentId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove student from group";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);

// DEV-QP.1: GET /api/groups/:id/barcode-sheet - Generate printable A4 PDF barcode sheet
groupsRouter.get(
  "/:id/barcode-sheet",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id: groupId } = req.params;

    try {
      const groupsService = getServices(req).groups;
      const { groupName, students } = await groupsService.getBarcodeStudents(groupId);

      const pdfBuffer = await generateBarcodeSheetPdf({
        group_name: groupName,
        students,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="group-${groupId}-barcodes.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "GROUP_NOT_FOUND") {
          res.status(404).json({ error: { code: "NOT_FOUND", message: "Group not found" } });
          return;
        }
        if (err.message === "NO_STUDENTS") {
          res.status(400).json({
            error: {
              code: "NO_STUDENTS",
              message: "This group does not have any enrolled students yet.",
            },
          });
          return;
        }
      }
      const message = err instanceof Error ? err.message : "Failed to generate barcode sheet";
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
    }
  }
);
