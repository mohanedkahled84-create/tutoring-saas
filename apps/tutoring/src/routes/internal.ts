import { Router, Request, Response } from "express";
import { getServiceSupabaseClient } from "../supabase.js";

export const internalRouter = Router();

// 1. GET /internal/tenants/:tenant_id/whatsapp-connection
// n8n calls this to fetch connection details and decrypted API key before sending
internalRouter.get("/tenants/:tenant_id/whatsapp-connection", async (req: Request, res: Response): Promise<void> => {
  const { tenant_id } = req.params;
  const supabase = getServiceSupabaseClient();

  try {
    const { data, error } = await supabase.rpc("get_tenant_whatsapp_connection", {
      p_tenant_id: tenant_id,
    });

    if (error) {
      res.status(500).json({ error: "Failed to retrieve WhatsApp connection", details: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: "WhatsApp connection not found for this tenant" });
      return;
    }

    res.json({
      provider: data.provider,
      instance_url: data.instance_url,
      instance_status: data.instance_status,
      api_key: data.api_key || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error", message: err.message });
  }
});

// 2. POST /internal/message-logs
// n8n calls this callback after sending to log outcome and confirm delivery
internalRouter.post("/message-logs", async (req: Request, res: Response): Promise<void> => {
  const supabase = getServiceSupabaseClient();
  const {
    tenant_id,
    idempotency_key,
    message_type,
    recipient_type,
    recipient_phone,
    status,
    error_detail,
    student_id,
    group_id,
    session_id,
  } = req.body;

  if (!tenant_id || !idempotency_key || !message_type || !recipient_type || !recipient_phone || !status) {
    res.status(400).json({
      error: "Missing required fields (tenant_id, idempotency_key, message_type, recipient_type, recipient_phone, status)",
    });
    return;
  }

  if (!["sent", "failed", "rejected", "needs_review"].includes(status)) {
    res.status(400).json({ error: "Invalid status value" });
    return;
  }

  try {
    // 1. Insert audit log into message_logs
    const { data: logEntry, error: logError } = await supabase
      .from("message_logs")
      .insert({
        tenant_id,
        idempotency_key,
        message_type,
        recipient_type,
        recipient_phone,
        status,
        error_detail: error_detail || null,
        student_id: student_id || null,
        group_id: group_id || null,
        session_id: session_id || null,
      })
      .select()
      .single();

    if (logError) {
      res.status(500).json({ error: "Failed to write message log", details: logError.message });
      return;
    }

    // 2. Enforce non-negotiable rule: ONLY mark attendance.sent = true upon confirmed 'sent' delivery
    let attendanceUpdated = false;
    if (status === "sent") {
      const { data: updatedAtt, error: attError } = await supabase
        .from("attendance")
        .update({ sent: true })
        .eq("idempotency_key", idempotency_key)
        .select();

      if (!attError && updatedAtt && updatedAtt.length > 0) {
        attendanceUpdated = true;
      }
    }

    res.status(201).json({
      success: true,
      message_log_id: logEntry.id,
      attendance_confirmed_sent: attendanceUpdated,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error", message: err.message });
  }
});
