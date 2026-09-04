/**
 * ============================================================================
 * Composition Root (Dependency Injection Wiring)
 * ============================================================================
 *
 * Architecture Rule 1 & Rule 8:
 * - Domain business logic (features/<name>/service.ts) NEVER imports or constructs
 *   database clients (@supabase/supabase-js).
 * - All database interactions are encapsulated behind feature repository interfaces
 *   (features/<name>/repository.ts).
 * - The Composition Root is the single place where Supabase-backed repositories
 *   are instantiated and injected into domain services.
 * - HTTP route handlers receive their configured services from this composition
 *   root (either via request context `req.services` or factory functions) rather
 *   than creating services or database connections directly.
 *
 * This design decouples business rules from the database engine, enabling
 * 100% in-memory unit testing with fake repositories and smooth future database migrations.
 * ============================================================================
 */

import { Response, NextFunction } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { AuthenticatedRequest } from "./types/index.js";
import { supabasePublic } from "./supabase.js";

import {
  RiskWatchlistService,
  SupabaseRiskWatchlistRepository,
} from "./features/risk-watchlist/index.js";

export interface AppServices {
  riskWatchlist: RiskWatchlistService;
  [serviceName: string]: unknown;
}

/**
 * Instantiates and wires repositories to services using the provided Supabase client.
 */
export function createCompositionRoot(client?: SupabaseClient): AppServices {
  const effectiveClient = client || supabasePublic;
  return {
    riskWatchlist: new RiskWatchlistService(new SupabaseRiskWatchlistRepository(effectiveClient)),
    _client: effectiveClient,
  };
}

/**
 * Express middleware to attach the composed services to the request context.
 */
export function injectServices(defaultClient?: SupabaseClient) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const client = req.supabase || defaultClient || supabasePublic;
    req.services = createCompositionRoot(client);
    next();
  };
}

/**
 * Helper to retrieve services from an incoming request or fallback to public container.
 */
export function getServices(req: AuthenticatedRequest): AppServices {
  if (req.services) {
    return req.services as unknown as AppServices;
  }
  return createCompositionRoot(req.supabase || supabasePublic);
}
