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
import { AuthenticatedRequest } from "./shared/types/index.js";
import { supabasePublic, getServiceSupabaseClient } from "./supabase.js";

import {
  RiskWatchlistService,
  SupabaseRiskWatchlistRepository,
} from "./features/risk-watchlist/index.js";
import {
  ActivityLogService,
  SupabaseActivityLogRepository,
} from "./features/activity-log/index.js";
import {
  SessionsService,
  SupabaseSessionsRepository,
} from "./features/sessions/index.js";
import {
  AttendanceService,
  SupabaseAttendanceRepository,
} from "./features/attendance/index.js";
import {
  WhatsAppNotificationsService,
  SupabaseWhatsAppNotificationsRepository,
} from "./features/whatsapp-notifications/index.js";
import {
  BillingService,
  SupabaseBillingRepository,
} from "./features/billing/index.js";
import {
  StudentsService,
  SupabaseStudentsRepository,
} from "./features/students/index.js";
import {
  GroupsService,
  SupabaseGroupsRepository,
} from "./features/groups/index.js";
import {
  AuthService,
  SupabaseAuthRepository,
} from "./features/auth/index.js";
import {
  AdminOpsService,
  SupabaseAdminOpsRepository,
} from "./features/admin-ops/index.js";
import {
  BusinessDashboardService,
  SupabaseBusinessDashboardRepository,
} from "./features/business-dashboard/index.js";

export interface AppServices {
  riskWatchlist: RiskWatchlistService;
  activityLog: ActivityLogService;
  sessions: SessionsService;
  attendance: AttendanceService;
  whatsapp: WhatsAppNotificationsService;
  billing: BillingService;
  students: StudentsService;
  groups: GroupsService;
  auth: AuthService;
  adminOps: AdminOpsService;
  businessDashboard: BusinessDashboardService;
  [serviceName: string]: unknown;
}

/**
 * Instantiates and wires repositories to services using the provided Supabase client.
 */
export function createCompositionRoot(client?: SupabaseClient): AppServices {
  const effectiveClient = client || supabasePublic;
  const adminClient = getServiceSupabaseClient();

  return {
    riskWatchlist: new RiskWatchlistService(new SupabaseRiskWatchlistRepository(effectiveClient)),
    activityLog: new ActivityLogService(new SupabaseActivityLogRepository(effectiveClient)),
    sessions: new SessionsService(new SupabaseSessionsRepository(effectiveClient)),
    attendance: new AttendanceService(new SupabaseAttendanceRepository(effectiveClient)),
    whatsapp: new WhatsAppNotificationsService(new SupabaseWhatsAppNotificationsRepository(effectiveClient)),
    billing: new BillingService(new SupabaseBillingRepository(effectiveClient)),
    students: new StudentsService(new SupabaseStudentsRepository(effectiveClient)),
    groups: new GroupsService(new SupabaseGroupsRepository(effectiveClient)),
    auth: new AuthService(new SupabaseAuthRepository(effectiveClient, adminClient)),
    adminOps: new AdminOpsService(new SupabaseAdminOpsRepository(adminClient)),
    businessDashboard: new BusinessDashboardService(new SupabaseBusinessDashboardRepository(adminClient)),
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
