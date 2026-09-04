import { Router, Request, Response } from "express";
import { supabasePublic } from "../supabase.js";

export const healthRouter = Router();

// Fast ping for uptime monitors (UptimeRobot, Railway, etc.)
healthRouter.get("/ping", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Detailed system health and dependency diagnostics
healthRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let dbStatus = "unknown";
  let dbLatencyMs = 0;
  let dbError: string | undefined;

  try {
    const { error } = await supabasePublic
      .from("tenants")
      .select("count", { count: "exact", head: true });
    dbLatencyMs = Date.now() - startTime;

    if (error) {
      dbStatus = "error";
      dbError = error.message;
    } else {
      dbStatus = "connected";
    }
  } catch (err: unknown) {
    dbStatus = "unreachable";
    dbError = (err as Error).message;
  }

  const isHealthy = dbStatus === "connected";
  const memoryUsage = process.memoryUsage();

  const responsePayload = {
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
    database: {
      status: dbStatus,
      latency_ms: dbLatencyMs,
      error: dbError,
    },
    system: {
      node_version: process.version,
      memory: {
        rss_mb: Math.round(memoryUsage.rss / (1024 * 1024)),
        heap_used_mb: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
      },
    },
  };

  res.status(isHealthy ? 200 : 503).json(responsePayload);
});
