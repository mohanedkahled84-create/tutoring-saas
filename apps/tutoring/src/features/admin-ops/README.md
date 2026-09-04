# Admin Operations Feature (`features/admin-ops`)

## Overview
The `admin-ops` feature encapsulates platform administration operations: cross-tenant management, metrics oversight, manual payment proof reviews (approval/rejection with subscription extensions), subscription overrides, and founder signup alert notifications.

## Architectural Boundaries (Clean Architecture)
- **`types.ts`**: Pure domain types (`AdminTenantSummary`, `AdminOverviewMetrics`, `PaymentProofAdminItem`, `ApprovePaymentProofResult`, `TenantSubscriptionOverrideDTO`, `NewSignupAlertPayload`) and `IAdminOpsRepository`.
- **`founderAlert.ts`**: Sub-concern responsible for formatting and asynchronously dispatching new teacher registration notifications to founders.
- **`service.ts`**: Pure domain business logic (`AdminOpsService`). Enforces 30-day renewal calculations upon proof approval, past-due markings upon rejection, and manual subscription lifecycle updates. ZERO database imports.
- **`repository.ts`**: Supabase data access layer (`SupabaseAdminOpsRepository`) and test double (`FakeAdminOpsRepository`).
- **`routes.ts`**: Express route handlers (`adminRouter`) protected with admin role verification.
- **`index.ts`**: Public barrel export.
