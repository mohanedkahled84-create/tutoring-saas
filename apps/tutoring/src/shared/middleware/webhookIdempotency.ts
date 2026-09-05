import crypto from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

export interface IdempotencyRecord {
  status: "processing" | "completed";
  statusCode?: number;
  headers?: Record<string, string>;
  body?: unknown;
  createdAt: number;
}

export class InMemoryWebhookIdempotencyStore {
  private store = new Map<string, IdempotencyRecord>();
  private readonly ttlMs: number;

  constructor(ttlMs = 24 * 60 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  get(key: string): IdempotencyRecord | undefined {
    const record = this.store.get(key);
    if (!record) return undefined;

    if (Date.now() - record.createdAt > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }

    return record;
  }

  set(key: string, record: IdempotencyRecord): void {
    this.store.set(key, record);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export const defaultWebhookStore = new InMemoryWebhookIdempotencyStore();

/**
 * Validates HMAC SHA-256 webhook signatures using constant-time comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  rawPayload: string | Buffer,
  secret: string,
  providedSignature: string
): boolean {
  if (!rawPayload || !secret || !providedSignature) {
    return false;
  }

  const cleanSignature = providedSignature.replace(/^sha256=/i, "").trim().toLowerCase();
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawPayload);
  const expectedSignature = hmac.digest("hex").toLowerCase();

  const bufProvided = Buffer.from(cleanSignature, "utf8");
  const bufExpected = Buffer.from(expectedSignature, "utf8");

  if (bufProvided.length !== bufExpected.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufProvided, bufExpected);
}

export interface WebhookIdempotencyOptions {
  store?: InMemoryWebhookIdempotencyStore;
  secret?: string | (() => string | undefined);
  signatureHeader?: string;
  requireSignature?: boolean;
  keyExtractor?: (req: Request) => string | undefined;
}

/**
 * Express middleware that enforces:
 * 1. Webhook signature verification (timing-safe HMAC SHA-256)
 * 2. Idempotent check-and-record semantics preventing duplicate execution of side-effects
 */
export function webhookIdempotency(options: WebhookIdempotencyOptions = {}) {
  const store = options.store || defaultWebhookStore;
  const signatureHeaderName = (options.signatureHeader || "x-webhook-signature").toLowerCase();
  const requireSignature = options.requireSignature ?? false;

  return (req: Request, res: Response, next: NextFunction): void => {
    // 1. Signature Verification
    if (requireSignature) {
      const secret = typeof options.secret === "function" ? options.secret() : options.secret;
      const signature = req.headers[signatureHeaderName] as string | undefined;

      if (!secret || !signature) {
        res.status(401).json({
          error: {
            code: "UNAUTHORIZED",
            message: "Missing webhook signature or secret unconfigured",
          },
        });
        return;
      }

      const payloadString =
        typeof req.body === "string" || Buffer.isBuffer(req.body)
          ? req.body
          : JSON.stringify(req.body);

      const isValid = verifyWebhookSignature(payloadString, secret, signature);
      if (!isValid) {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Invalid webhook signature",
          },
        });
        return;
      }
    }

    // 2. Extract Idempotency Key
    let idempotencyKey: string | undefined;
    if (options.keyExtractor) {
      idempotencyKey = options.keyExtractor(req);
    } else {
      idempotencyKey =
        (req.headers["x-idempotency-key"] as string) ||
        (req.headers["idempotency-key"] as string) ||
        (req.body && typeof req.body === "object" ? req.body.idempotency_key || req.body.event_id : undefined);
    }

    if (!idempotencyKey) {
      // No idempotency key provided; proceed normally
      next();
      return;
    }

    // 3. Check Idempotency Store
    const existing = store.get(idempotencyKey);
    if (existing) {
      if (existing.status === "processing") {
        res.status(409).json({
          error: {
            code: "IDEMPOTENCY_CONFLICT",
            message: "This webhook is already being processed",
          },
        });
        return;
      }

      if (existing.status === "completed") {
        logger.info(`[WebhookIdempotency] Idempotent replay for key: ${idempotencyKey}`);
        res.setHeader("X-Idempotent-Replay", "true");
        res.status(existing.statusCode || 200).json(existing.body);
        return;
      }
    }

    // 4. Mark as 'processing'
    store.set(idempotencyKey, {
      status: "processing",
      createdAt: Date.now(),
    });

    // 5. Intercept response to record outcome
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown): Response {
      const statusCode = res.statusCode;

      if (statusCode < 400 && idempotencyKey) {
        store.set(idempotencyKey, {
          status: "completed",
          statusCode,
          body,
          createdAt: Date.now(),
        });
      } else if (idempotencyKey) {
        // If operation failed, allow retry by deleting key
        store.delete(idempotencyKey);
      }

      return originalJson(body);
    };

    next();
  };
}
