import * as Sentry from "@sentry/node";
import dotenv from "dotenv";
import {redactPhoneAuthTelemetry} from './shared/utils/phoneAuthRedaction.js';

// Load environment variables so Sentry can access SENTRY_DSN even if imported before config
dotenv.config();

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    // 100% traces in dev, 20% in production
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    includeLocalVariables: false,
    beforeBreadcrumb: breadcrumb=>redactPhoneAuthTelemetry(breadcrumb),
    beforeSend: event=>redactPhoneAuthTelemetry(event),
    beforeSendTransaction: event=>redactPhoneAuthTelemetry(event),
    enableLogs: true,
  });
  console.log("[Sentry] Error monitoring and performance tracing initialized.");
} else {
  console.log("[Sentry] SENTRY_DSN is not set. Monitoring is inactive.");
}

export { Sentry };
