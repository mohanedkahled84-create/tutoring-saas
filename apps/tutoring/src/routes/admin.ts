import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { requireAdmin } from "../middleware/auth.js";
import { getServiceSupabaseClient } from "../supabase.js";

export const adminRouter = Router();

// Apply requireAdmin to all routes in this router
adminRouter.use(requireAdmin);

// GET /api/admin/tenants - Admin only: view all tenants across system
adminRouter.get("/tenants", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = getServiceSupabaseClient();

  try {
    const { data: tenants, error } = await supabase
      .from("tenants")
      .select("id, name, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: error.message } });
      return;
    }

    res.json({ tenants });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// GET /api/admin/overview - Admin only: platform metrics overview
adminRouter.get("/overview", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const supabase = getServiceSupabaseClient();

  try {
    const [{ count: tenantCount }, { count: studentCount }, { count: sessionCount }] = await Promise.all([
      supabase.from("tenants").select("*", { count: "exact", head: true }),
      supabase.from("students").select("*", { count: "exact", head: true }),
      supabase.from("sessions").select("*", { count: "exact", head: true }),
    ]);

    res.json({
      metrics: {
        total_tenants: tenantCount || 0,
        total_students: studentCount || 0,
        total_sessions: sessionCount || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
