import { Router, Response, Request } from "express";
import { validateBody, publicSelfRegisterSchema } from "../middleware/validation.js";
import { getServiceSupabaseClient } from "../supabase.js";

export const publicRouter = Router();

// POST /api/public/register - Student Self-Registration from shareable link
publicRouter.post(
  "/register",
  validateBody(publicSelfRegisterSchema),
  async (req: Request, res: Response): Promise<void> => {
    const supabase = getServiceSupabaseClient();
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
        message: "تم تسجيل بيانات الطالب بنجاح",
        student,
        verification_message_queued: true,
      });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to self-register" } });
    }
  }
);
