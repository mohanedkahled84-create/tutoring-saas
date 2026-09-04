import { Request, Response, NextFunction } from "express";
import { z, ZodSchema, ZodError } from "zod";

// Generic request body validation middleware
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: unknown) {
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

// DEV-PV.1: Strict Egyptian Mobile Phone Validator (010, 011, 012, 015 + 8 digits = 11 digits total)
export const egyptianPhoneRegex = /^01[0125][0-9]{8}$/;

export function cleanEgyptianPhone(val: string): string {
  if (!val) return "";
  let clean = val.trim().replace(/[\s\-().]/g, "");
  if (clean.startsWith("+20")) clean = clean.slice(3);
  else if (clean.startsWith("0020")) clean = clean.slice(4);
  else if (clean.startsWith("20") && clean.length === 12) clean = clean.slice(2);
  if (!clean.startsWith("0") && clean.length === 10) clean = "0" + clean;
  return clean;
}

export const egyptianPhoneSchema = z
  .string()
  .transform(cleanEgyptianPhone)
  .pipe(
    z
      .string()
      .regex(
        egyptianPhoneRegex,
        "رقم الهاتف يجب أن يكون رقم محمول مصري يبدأ بـ 010 أو 011 أو 012 أو 015 ومكون من 11 رقماً"
      )
  );

// Student Schemas
export const createStudentSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  parent_phone: egyptianPhoneSchema,
  student_phone: egyptianPhoneSchema.optional().nullable(),
  code: z.string().max(50).optional().nullable(),
  student_code: z.string().max(50).optional().nullable(),
  fee_override: z.number().positive().optional().nullable(),
  exempt: z.boolean().optional().default(false),
  notes: z.string().max(500).optional().nullable(),
});

export const updateStudentSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  parent_phone: egyptianPhoneSchema.optional(),
  student_phone: egyptianPhoneSchema.optional().nullable(),
  code: z.string().max(50).optional().nullable(),
  student_code: z.string().max(50).optional().nullable(),
  fee_override: z.number().positive().optional().nullable(),
  exempt: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
});

export const publicSelfRegisterSchema = z.object({
  tenant_id: z.string().uuid("tenant_id must be a valid UUID"),
  name: z.string().min(1, "Name is required").max(150),
  parent_phone: egyptianPhoneSchema,
  student_phone: egyptianPhoneSchema.optional().nullable(),
  group_id: z.string().uuid("group_id must be a valid UUID"),
});

// Group Schemas
export const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100),
  center_name: z.string().max(150).optional().nullable(),
  price: z.number().min(0).optional().default(0),
  session_price: z.number().min(0).optional().default(0),
  billing_model: z.enum(["percentage", "fixed_rent"]).optional().default("percentage"),
  fixed_rent_amount: z.number().min(0).optional().nullable(),
  center_cut_percentage: z.number().min(0).max(100).optional().default(0),
  teacher_cut_percentage: z.number().min(0).max(100).optional().default(100),
});

export const updateGroupSchema = createGroupSchema.partial();

export const enrollStudentSchema = z.object({
  student_id: z.string().uuid("student_id must be a valid UUID"),
});

// Session & Scan Schemas
export const createSessionSchema = z.object({
  group_id: z.string().uuid("group_id must be a valid UUID"),
  session_number: z.number().int().positive("session_number must be a positive integer"),
  session_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "session_date must be in YYYY-MM-DD format"),
});

// DEV-50: Cancel, Reschedule, Extra Session Schemas
export const cancelSessionSchema = z.object({
  reason: z.string().max(300).optional(),
  notify_parents: z.boolean().optional().default(true),
});

export const rescheduleSessionSchema = z.object({
  new_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "new_date must be in YYYY-MM-DD format"),
  new_time: z.string().max(50).optional(),
  reason: z.string().max(300).optional(),
  notify_parents: z.boolean().optional().default(true),
});

export const extraSessionSchema = z.object({
  group_id: z.string().uuid("group_id must be a valid UUID"),
  session_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "session_date must be in YYYY-MM-DD format"),
  session_time: z.string().max(50).optional(),
  topic: z.string().max(200).optional(),
  notify_parents: z.boolean().optional().default(true),
});

export const quickCheckinSchema = z.object({
  code: z.string().min(1, "Student code or barcode is required"),
});

// DEV-SBL.1: Scan schema
export const scanStudentSchema = z
  .object({
    student_id: z.string().uuid().optional(),
    student_code: z.string().min(1).optional(),
    homework_status: z.enum(["done", "partial", "missing"]).optional().nullable(),
    is_makeup: z.boolean().optional().default(false),
    home_group_id: z.string().uuid().optional().nullable(),
    comment: z.string().max(500).optional().nullable(),
  })
  .refine((data) => data.student_id || data.student_code, {
    message: "Either student_id or student_code must be provided",
  });

// DEV-SBL.2: Quiz auto-save schema
export const quizScoreSchema = z
  .object({
    score: z.number().min(0, "Score cannot be negative"),
    max_score: z.number().positive("Max score must be positive"),
  })
  .refine((data) => data.score <= data.max_score, {
    message: "Score cannot exceed max_score",
  });

export const recordAttendanceSchema = z.object({
  records: z
    .array(
      z.object({
        student_id: z.string().uuid("student_id must be a valid UUID"),
        attended: z.boolean(),
        comment: z.string().max(500).optional().nullable(),
        homework_status: z.enum(["done", "partial", "missing"]).optional().nullable(),
        is_makeup: z.boolean().optional().default(false),
        home_group_id: z.string().uuid().optional().nullable(),
        quiz_score: z.number().min(0).max(100).optional().nullable(),
        quiz_max_score: z.number().min(0).optional().default(20),
      })
    )
    .min(1, "At least one attendance record is required"),
});

export const bulkUpdateQuizzesSchema = z.object({
  quizzes: z
    .array(
      z.object({
        student_id: z.string().uuid("student_id must be a valid UUID"),
        quiz_score: z.number().min(0).max(100).nullable(),
        quiz_max_score: z.number().min(0).optional().default(20),
      })
    )
    .min(1, "At least one quiz record is required"),
});

export const saveTemplateSchema = z.object({
  template_type: z.enum([
    "attendance_present",
    "attendance_absent",
    "quiz_result",
    "quiz_absent",
    "welcome_student",
    "welcome_parent",
    "custom",
  ]),
  variants: z.array(z.string().min(1)).min(1, "At least one variant is required"),
  is_active: z.boolean().optional().default(true),
});

export const internalMessageLogSchema = z.object({
  tenant_id: z.string().uuid("tenant_id must be a valid UUID"),
  idempotency_key: z.string().min(1, "idempotency_key is required"),
  message_type: z.string().min(1),
  recipient_type: z.enum(["parent", "student", "system"]),
  recipient_phone: z.string().min(7, "recipient_phone must be valid"),
  status: z.enum(["sent", "failed", "rejected", "needs_review"]),
  error_detail: z.string().nullable().optional(),
  student_id: z.string().uuid().nullable().optional(),
  group_id: z.string().uuid().nullable().optional(),
  session_id: z.string().uuid().nullable().optional(),
});
// DEV-OFS.1 & DEV-OFS.2: Offline-First Batch Sync Schema
export const offlineBatchSyncSchema = z.object({
  sync_items: z
    .array(
      z.object({
        idempotency_key: z.string().min(1, "idempotency_key is required"),
        student_id: z.string().uuid("student_id must be a valid UUID"),
        session_id: z.string().uuid("session_id must be a valid UUID"),
        attended: z.boolean(),
        comment: z.string().max(500).optional().nullable(),
        homework_status: z.enum(["done", "partial", "missing"]).optional().nullable(),
        is_makeup: z.boolean().optional().default(false),
        home_group_id: z.string().uuid().optional().nullable(),
        client_timestamp: z.string().optional(),
      })
    )
    .min(1, "At least one sync item is required"),
});
