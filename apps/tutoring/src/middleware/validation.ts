import { Request, Response, NextFunction } from "express";
import { z, ZodSchema, ZodError } from "zod";

// DEV-APISEC.2: Generic request body validation middleware
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));

        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details,
          },
        });
        return;
      }
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Malformed request payload",
        },
      });
    }
  };
}

// Schemas for endpoints
export const createStudentSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  parent_phone: z.string().min(7, "Valid parent phone number is required").max(25),
  student_phone: z.string().max(25).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateStudentSchema = createStudentSchema.partial();

export const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100),
});

export const updateGroupSchema = createGroupSchema.partial();

export const enrollStudentSchema = z.object({
  student_id: z.string().uuid("student_id must be a valid UUID"),
});

export const createSessionSchema = z.object({
  group_id: z.string().uuid("group_id must be a valid UUID"),
  session_number: z.number().int().positive("session_number must be a positive integer"),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "session_date must be in YYYY-MM-DD format"),
});

export const recordAttendanceSchema = z.object({
  records: z
    .array(
      z.object({
        student_id: z.string().uuid("student_id must be a valid UUID"),
        attended: z.boolean(),
        comment: z.string().max(500).optional().nullable(),
      })
    )
    .min(1, "At least one attendance record is required"),
});

export const internalMessageLogSchema = z.object({
  tenant_id: z.string().uuid("tenant_id must be a valid UUID"),
  idempotency_key: z.string().min(1, "idempotency_key is required"),
  message_type: z.enum(["attendance_absent", "attendance_present_comment"]),
  recipient_type: z.enum(["parent", "student", "system"]),
  recipient_phone: z.string().min(7, "recipient_phone must be valid"),
  status: z.enum(["sent", "failed", "rejected", "needs_review"]),
  error_detail: z.string().nullable().optional(),
  student_id: z.string().uuid().nullable().optional(),
  group_id: z.string().uuid().nullable().optional(),
  session_id: z.string().uuid().nullable().optional(),
});
