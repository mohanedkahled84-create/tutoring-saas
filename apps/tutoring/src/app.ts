import express, { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import {
  authenticateUser,
  authenticateInternalSecret,
  globalRateLimiter,
  authRateLimiter,
  securityHeadersMiddleware,
  notFoundHandler,
  globalErrorHandler,
  healthRouter,
  publicRouter,
  internalRouter,
} from "./shared/index.js";
import { authRouter } from "./features/auth/index.js";
import { adminRouter } from "./features/admin-ops/index.js";
import { groupsRouter } from "./features/groups/index.js";
import { studentsRouter, importRouter } from "./features/students/index.js";
import { sessionsRouter } from "./features/sessions/index.js";
import { riskRouter } from "./features/risk-watchlist/index.js";
import { injectServices } from "./composition.js";
import { billingRouter } from "./features/billing/index.js";
import { activityLogsRouter } from "./features/activity-log/index.js";
import { templatesRouter, whatsappRouter } from "./features/whatsapp-notifications/index.js";
import { settingsRouter } from "./features/auth/settingsRoutes.js";
import { businessDashboardRouter } from "./features/business-dashboard/index.js";
import { telemetryRouter } from "./features/telemetry/index.js";
import { centersRouter } from "./features/centers/index.js";

export function createApp(): Express {
  const app = express();

  // DEV-24: HTTPS enforcement & standard security headers (HSTS, CSP, X-Frame-Options)
  app.use(securityHeadersMiddleware);

  // DEV-24 & Security Hardening: Strict CORS origin allowlist with credentials
  const defaultAllowedOrigins = [
    "https://centrly.app",
    "https://www.centrly.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ];
  const configuredOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : defaultAllowedOrigins;

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || configuredOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("CORS: Origin not allowed"));
        }
      },
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  // Health and uptime monitoring (unthrottled for monitoring agents)
  app.use("/health", healthRouter);

  // DEV-AUTH.3 & DEV-APISEC.1: Auth routes with strict rate limiting
  app.use("/api/auth", authRateLimiter, authRouter);

  // Public endpoints (Self-registration from shareable links - no token needed)
  app.use("/api/public", publicRouter);

  // Global rate limiter for protected API routes
  app.use("/api", globalRateLimiter);

  // Services dependency injection middleware
  app.use(injectServices());

  // DEV-AUTH.2: Admin endpoints (strictly requires role === 'admin')
  app.use("/api/admin", authenticateUser, adminRouter);

  // Tenant-scoped User API routes (requires valid token & tenant context)
  app.use("/api/students", authenticateUser, studentsRouter);
  app.use("/api/groups", authenticateUser, groupsRouter);
  app.use("/api/groups", authenticateUser, importRouter);
  app.use("/api/sessions", authenticateUser, sessionsRouter);
  app.use("/api/at-risk", authenticateUser, riskRouter);
  app.use("/api/billing", authenticateUser, billingRouter);
  app.use("/api/activity-logs", authenticateUser, activityLogsRouter);
  app.use("/api/templates", authenticateUser, templatesRouter);
  app.use("/api/whatsapp", authenticateUser, whatsappRouter);
  app.use("/api/settings", authenticateUser, settingsRouter);
  app.use("/api/business-dashboard", authenticateUser, businessDashboardRouter);
  app.use("/api/telemetry", telemetryRouter);
  app.use("/api/centers", centersRouter);

  // DEV-WPA.1: Protected Internal Automation routes (shared-secret auth)
  app.use("/internal", authenticateInternalSecret, internalRouter);

  // DEV-ERRM.1: Uniform 404 handler and global error handling middleware
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}

export const app = createApp();
