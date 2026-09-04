import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import crypto from "node:crypto";

export function notFoundHandler(req: Request, res: Response): void {
  const requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Cannot ${req.method} ${req.path}`,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId,
  });
}

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  const errObj = (err && typeof err === "object" ? err : {}) as Record<string, unknown>;
  const statusCode =
    typeof errObj.statusCode === "number"
      ? errObj.statusCode
      : errObj.status
        ? parseInt(String(errObj.status), 10)
        : 500;
  const code =
    typeof errObj.code === "string"
      ? errObj.code
      : statusCode >= 500
        ? "INTERNAL_ERROR"
        : "BAD_REQUEST";
  const message =
    typeof errObj.message === "string" ? errObj.message : "An unexpected error occurred";

  // Log all 5xx or unhandled operational errors with context
  if (statusCode >= 500) {
    logger.error(`[UnhandledError] ${req.method} ${req.path}`, err, {
      requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      body: req.body,
    });
  } else {
    logger.warn(`[ClientError ${statusCode}] ${req.method} ${req.path}: ${message}`, {
      requestId,
      code,
      details: errObj.details,
    });
  }

  // Safe client response - no stack traces leaked
  res.status(statusCode).json({
    error: {
      code,
      message:
        statusCode >= 500 && process.env.NODE_ENV === "production"
          ? "Internal server error"
          : message,
      details: errObj.details || undefined,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId,
  });
}
