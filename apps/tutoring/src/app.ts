import express, { Express, Request, Response } from "express";
import cors from "cors";
import { authenticateUser } from "./middleware/auth.js";
import { authenticateInternalSecret } from "./middleware/internalAuth.js";
import { studentsRouter } from "./routes/students.js";
import { groupsRouter } from "./routes/groups.js";
import { sessionsRouter } from "./routes/sessions.js";
import { internalRouter } from "./routes/internal.js";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Protected User API routes (Tenant context & RLS enforcement)
  app.use("/api/students", authenticateUser, studentsRouter);
  app.use("/api/groups", authenticateUser, groupsRouter);
  app.use("/api/sessions", authenticateUser, sessionsRouter);

  // DEV-WPA.1: Protected Internal Automation routes (n8n ↔ Backend shared secret)
  app.use("/internal", authenticateInternalSecret, internalRouter);

  return app;
}

export const app = createApp();
