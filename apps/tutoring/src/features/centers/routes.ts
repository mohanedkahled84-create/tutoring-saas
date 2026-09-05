import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { authenticateUser, requireCenterOwnerOrAdmin } from "../../shared/middleware/auth.js";
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
// Center Management Endpoints (Requires Center Owner or Admin)
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
