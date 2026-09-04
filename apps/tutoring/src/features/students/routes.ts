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
  const { q } = req.query;

  try {
    const studentsService = getServices(req).students;
    const students = await studentsService.listStudents(
      tenantId,
      typeof q === "string" ? q : undefined
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

  const token = generateParentPortalToken(studentId, tenantId || "default", 30);
  const portalUrl = `/parent-portal?token=${token}`;

  res.json({
    student_id: studentId,
    token,
    portal_url: portalUrl,
    expires_in_days: 30,
  });
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
