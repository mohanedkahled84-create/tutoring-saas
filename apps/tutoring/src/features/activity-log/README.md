# Activity Log Feature (`features/activity-log`)

## Overview
Provides audit logging for critical teacher and assistant actions (recording/editing attendance, opening/closing sessions, recording quiz scores) and exposes an audit log query endpoint for owners and admins.

## Architecture Compliance (Rules 1-8)
- **`types.ts`**: Pure TypeScript contracts (`IActivityLogRepository`, `ActivityLogEntry`, `ActivityLogItem`, `ActivityLogFilter`).
- **`service.ts`**: Business logic with zero `@supabase/supabase-js` imports. Enforces role-based access rules (assistants barred from viewing audit log) and graceful fault tolerance during log writes.
- **`repository.ts`**: Direct Supabase client interaction (`SupabaseActivityLogRepository`).
- **`routes.ts`**: HTTP router resolving `ActivityLogService` from the composition root (`getServices(req).activityLog`).
- **`index.ts`**: Public barrel module.

## Access Rules
- **Write**: Logged automatically during attendance, session, and quiz operations.
- **Read**: Restricted to `owner` and `admin` roles only. `assistant` role receives a `403 Forbidden` response.
