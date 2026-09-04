import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { computeAtRiskWatchlist } from "../services/riskEngine.js";
import { z } from "zod";
import { validateBody } from "../middleware/validation.js";

export const riskRouter = Router();

// Schema for sending tailored at-risk alert
const sendAlertSchema = z.object({
  alert_type: z.enum(["absence_warning", "grade_drop", "homework_neglect", "parent_meeting"]),
  custom_message: z.string().max(500).optional().nullable(),
});

// DEV-ARW.1: GET /api/at-risk/watchlist - Compute on-demand watchlist
riskRouter.get("/watchlist", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = req.supabase!;
  const tenantId = req.user!.tenant_id;
  const { group_id } = req.query;

  if (!tenantId && req.user!.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const watchlist = await computeAtRiskWatchlist(
      supabase,
      tenantId!,
      group_id as string | undefined
    );

    res.json({
      timestamp: new Date().toISOString(),
      total_at_risk: watchlist.length,
      high_severity_count: watchlist.filter((s) => s.severity === "high").length,
      watchlist,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Risk computation failed", details: err.message },
    });
  }
});

// DEV-ARW.2: POST /api/at-risk/alerts/:student_id - Trigger tailored alert
riskRouter.post(
  "/alerts/:student_id",
  validateBody(sendAlertSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { student_id } = req.params;
    const { alert_type, custom_message } = req.body;

    try {
      // 1. Fetch student
      const { data: student, error: studentErr } = await supabase
        .from("students")
        .select("id, name, parent_phone")
        .eq("id", student_id)
        .eq("tenant_id", tenantId)
        .single();

      if (studentErr || !student) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found" } });
        return;
      }

      // 2. Prepare idempotency key per student and day/type
      const todayDate = new Date().toISOString().slice(0, 10);
      const idempotencyKey = `${tenantId}:${student.id}:alert:${alert_type}:${todayDate}`;

      // 3. Log alert intent in message_logs
      const { data: logEntry, error: logErr } = await supabase
        .from("message_logs")
        .upsert(
          {
            tenant_id: tenantId,
            student_id: student.id,
            idempotency_key: idempotencyKey,
            message_type: alert_type,
            recipient_type: "parent",
            recipient_phone: student.parent_phone,
            status: "needs_review", // queued for delivery
            error_detail: custom_message || null,
          },
          { onConflict: "idempotency_key" }
        )
        .select()
        .single();

      if (logErr) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: logErr.message } });
        return;
      }

      res.status(200).json({
        message: "At-risk alert queued successfully",
        alert: {
          student_id: student.id,
          student_name: student.name,
          recipient_phone: student.parent_phone,
          alert_type,
          idempotency_key: idempotencyKey,
          status: logEntry.status,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to queue alert" } });
    }
  }
);
