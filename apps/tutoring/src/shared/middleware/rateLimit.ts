import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

// DEV-APISEC.1: Global rate limiter (1000 requests per 15 minutes per IP)
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
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

// Sensitive auth endpoints (login, signup) - 50 attempts per 15 minutes, skipping successful logins
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  skipSuccessfulRequests: true,
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

// C-04: Security PIN verification and modification rate limiter
export const financialPinRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => `${(req as Request & { user?: { id?: string } }).user?.id || "anonymous"}:${req.ip}`,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: { code: "PIN_RATE_LIMITED", message: "تم إيقاف محاولات رمز الأمان مؤقتًا. حاول لاحقًا." } });
  },
});

// C-05: Rate limiter for public homework upload / submission (5 requests/minute per IP)
export const homeworkSubmissionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "تم تجاوز الحد المسموح لتسليم الواجبات (5 محاولات في الدقيقة). يرجى الانتظار دقيقة وإعادة المحاولة.",
      },
    });
  },
});

