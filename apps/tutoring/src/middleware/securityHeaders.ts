import { Request, Response, NextFunction } from "express";

/**
 * DEV-24: HTTPS & Security Headers Middleware
 * Enforces HTTPS redirects behind reverse proxies (Railway, Heroku, etc.)
 * and injects standard security headers:
 * - Strict-Transport-Security (HSTS)
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Content-Security-Policy (CSP)
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // DEV-HTTPS.1: Enforce HTTPS when running behind reverse proxy in production
  if (process.env.NODE_ENV === "production") {
    const proto = req.headers["x-forwarded-proto"];
    if (proto && proto !== "https") {
      const host = req.headers.host || req.hostname;
      res.redirect(301, `https://${host}${req.originalUrl}`);
      return;
    }
  }

  // DEV-HTTPS.1: HSTS (Strict-Transport-Security)
  // Max-age = 1 year, includes subdomains, preload
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  // DEV-HTTPS.2: Security Headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), payment=()"
  );

  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co;"
  );

  next();
}
