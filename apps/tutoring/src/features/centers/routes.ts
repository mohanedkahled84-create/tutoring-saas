import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import {
  authenticateUser,
  requireCenterOwnerOrAdmin,
  requireFinancialAccess,
} from "../../shared/middleware/auth.js";
import { getServices } from "../../composition.js";
import { CentersService } from "./service.js";

export const centersRouter = Router();

function resolveCentersService(req: AuthenticatedRequest): CentersService {
  const services = getServices(req);
  return services.centers as CentersService;
}

// ============================================================================
// Public Invitation Acceptance Endpoint
// ============================================================================
centersRouter.post("/invitations/accept", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { token, password, email } = req.body;
  if (!token || !password) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "token and password are required" },
    });
    return;
  }

  try {
    const service = resolveCentersService(req);
    const result = await service.acceptInvite({ token, password, email });
    res.status(200).json(result);
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "INVALID_OR_EXPIRED_TOKEN" || msg === "INVITATION_NOT_AVAILABLE") {
      res.status(400).json({ error: { code: "INVALID_TOKEN", message: "Invite token is invalid or has expired" } });
      return;
    }
    if (msg === "WEAK_PASSWORD") {
      res.status(400).json({ error: { code: "WEAK_PASSWORD", message: "Password must be at least 8 characters" } });
      return;
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: msg } });
  }
});

// ============================================================================
// Teacher & Assistant Management Endpoints (Requires Center Owner or Admin)
// ============================================================================

// GET /api/centers/teachers - List all teachers in center
centersRouter.get(
  "/teachers",
  authenticateUser,
  requireCenterOwnerOrAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveCentersService(req);
      const teachers = await service.listTeachers(tenantId);
      res.json({ teachers, count: teachers.length });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);

// POST /api/centers/teachers - Add a new teacher (invite link or direct creation)
centersRouter.post(
  "/teachers",
  authenticateUser,
  requireCenterOwnerOrAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveCentersService(req);
      const result = await service.addTeacher(tenantId, req.body);
      res.status(201).json(result);
    } catch (err: unknown) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: (err as Error).message } });
    }
  }
);

// POST /api/centers/teachers/:id/resend-invite - Resend fresh invite token to teacher
centersRouter.post(
  "/teachers/:id/resend-invite",
  authenticateUser,
  requireCenterOwnerOrAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { id: teacherId } = req.params;

    try {
      const service = resolveCentersService(req);
      const result = await service.resendTeacherInvite(tenantId || "", teacherId);
      res.json(result);
    } catch (err: unknown) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: (err as Error).message } });
    }
  }
);

// GET /api/centers/assistants - List all assistants in center
centersRouter.get(
  "/assistants",
  authenticateUser,
  requireCenterOwnerOrAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveCentersService(req);
      const assistants = await service.listAssistants(tenantId);
      res.json({ assistants, count: assistants.length });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);

// POST /api/centers/assistants - Add a new assistant (to teacher or center)
centersRouter.post(
  "/assistants",
  authenticateUser,
  requireCenterOwnerOrAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveCentersService(req);
      const result = await service.addAssistant(tenantId, req.body);
      res.status(201).json(result);
    } catch (err: unknown) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: (err as Error).message } });
    }
  }
);

// POST /api/centers/assistants/:id/resend-invite - Resend fresh invite token to assistant
centersRouter.post(
  "/assistants/:id/resend-invite",
  authenticateUser,
  requireCenterOwnerOrAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { id: assistantId } = req.params;

    try {
      const service = resolveCentersService(req);
      const result = await service.resendAssistantInvite(tenantId || "", assistantId);
      res.json(result);
    } catch (err: unknown) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: (err as Error).message } });
    }
  }
);

// ============================================================================
// DEV-77: Rooms Management & Conflict Check Endpoints
// ============================================================================

// GET /api/centers/rooms - List all rooms in center
centersRouter.get(
  "/rooms",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveCentersService(req);
      const rooms = await service.listRooms(tenantId);
      res.json({ rooms, count: rooms.length });
    } catch (err: unknown) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
    }
  }
);

// POST /api/centers/rooms - Create a room (Requires Center Owner or Admin)
centersRouter.post(
  "/rooms",
  authenticateUser,
  requireCenterOwnerOrAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveCentersService(req);
      const room = await service.createRoom(tenantId, req.body);
      res.status(201).json({ room });
    } catch (err: unknown) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: (err as Error).message } });
    }
  }
);

// GET /api/centers/rooms/:roomId - Get a room details
centersRouter.get(
  "/rooms/:roomId",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { roomId } = req.params;

    try {
      const service = resolveCentersService(req);
      const room = await service.getRoomById(tenantId || "", roomId);
      res.json({ room });
    } catch (err: unknown) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: (err as Error).message } });
    }
  }
);

// GET /api/centers/rooms/:roomId/availability - Query room bookings on date
centersRouter.get(
  "/rooms/:roomId/availability",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { roomId } = req.params;
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    try {
      const service = resolveCentersService(req);
      const availability = await service.getRoomAvailability(tenantId || "", roomId, date);
      res.json(availability);
    } catch (err: unknown) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: (err as Error).message } });
    }
  }
);

// POST /api/centers/rooms/check-conflict - Test if a proposed slot conflicts
centersRouter.post(
  "/rooms/check-conflict",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveCentersService(req);
      const result = await service.checkRoomConflict(tenantId, req.body);
      res.json(result);
    } catch (err: unknown) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: (err as Error).message } });
    }
  }
);

// ============================================================================
// DEV-77: Front-Desk / Smart Gate Mode Scan Endpoint
// ============================================================================

// POST /api/centers/front-desk-scan - Scan student barcode at reception
centersRouter.post(
  "/front-desk-scan",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveCentersService(req);
      const result = await service.frontDeskScan(tenantId, req.body);
      res.json(result);
    } catch (err: unknown) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: (err as Error).message } });
    }
  }
);

// ============================================================================
// DEV-78: Per-Teacher Financial Settings, Reports & Payout Status Endpoints
// ============================================================================

// GET /api/centers/financials/rollup - Center-wide financial rollup across all teachers
centersRouter.get(
  "/financials/rollup",
  authenticateUser,
  requireCenterOwnerOrAdmin,
  requireFinancialAccess,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);

    try {
      const service = resolveCentersService(req);
      const rollup = await service.getCenterFinancialRollup(tenantId || "", period);
      res.json(rollup);
    } catch (err: unknown) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: (err as Error).message } });
    }
  }
);

// GET /api/centers/financials/teachers/:teacherId - Per-teacher financial report
centersRouter.get(
  "/financials/teachers/:teacherId",
  authenticateUser,
  requireFinancialAccess,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    const { teacherId } = req.params;
    const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);

    // If teacher role, verify accessing own report
    if (req.user?.role === "teacher" && req.user.teacher_id && req.user.teacher_id !== teacherId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Cannot view other teachers' financial reports" } });
      return;
    }

    try {
      const service = resolveCentersService(req);
      const report = await service.getTeacherFinancialReport(tenantId || "", teacherId, period);
      res.json(report);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg === "TEACHER_NOT_FOUND") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Teacher not found" } });
        return;
      }
      res.status(400).json({ error: { code: "BAD_REQUEST", message: msg } });
    }
  }
);

// POST /api/centers/financials/payouts - Set payout status (paid / unpaid)
centersRouter.post(
  "/financials/payouts",
  authenticateUser,
  requireCenterOwnerOrAdmin,
  requireFinancialAccess,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    try {
      const service = resolveCentersService(req);
      const result = await service.setTeacherPayoutStatus(tenantId, {
        ...req.body,
        paid_by: req.user?.id,
      });
      res.json({ success: true, payout: result });
    } catch (err: unknown) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: (err as Error).message } });
    }
  }
);
