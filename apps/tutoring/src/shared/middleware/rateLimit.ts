import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

// DEV-APISEC.1: Global rate limiter (100 requests per 15 minutes per IP)
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests from this IP. Please try again later.",
      },
    });
  },
});

// Sensitive auth endpoints (login, signup) - 10 attempts per 15 minutes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many authentication attempts. Please try again in 15 minutes.",
      },
    });
  },
});

// Attendance recording / message sending path - 30 records/minute per IP
export const attendanceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message:
          "Attendance submission rate limit exceeded. Please wait a minute before submitting again.",
      },
    });
  },
});

// DEV-55 / M-02: Telemetry batch ingestion rate limiter - 60 batches/minute per IP
export const telemetryRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Telemetry ingestion rate limit exceeded. Please try again later.",
      },
    });
  },
});
