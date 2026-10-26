import { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Reject cross-origin state changes authenticated only by ambient cookies. */
export function createCookieCsrfGuard(isAllowedOrigin: (origin: string) => boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const cookieToken = req.cookies?.access_token || req.cookies?.["sb-access-token"];
    const authorization = req.get("authorization") || "";
    if (!cookieToken || /^Bearer\s+\S+/i.test(authorization)) {
      next();
      return;
    }

    const origin = req.get("origin");
    const fetchSite = req.get("sec-fetch-site");
    if (!origin || !isAllowedOrigin(origin) || fetchSite === "cross-site") {
      res.status(403).json({
        error: {
          code: "CSRF_FORBIDDEN",
          message: "Cross-origin cookie-authenticated requests are not allowed",
        },
      });
      return;
    }

    next();
  };
}
