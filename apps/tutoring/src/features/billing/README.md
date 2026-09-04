# Billing Feature (`features/billing`)

## Overview
Manages platform subscription billing, payment proof verification submissions (InstaPay, Vodafone Cash, Bank Transfer), subscription countdown status, and automated renewal reminder dispatching.

## Architecture Compliance (Rules 1-8)
- **`types.ts`**: Pure TypeScript contracts (`IBillingRepository`, `PaymentProofInput`, `PaymentProofRecord`, `TenantBillingStatus`, `DispatchRemindersSummary`).
- **`service.ts`**: Pure domain logic and calculations with **zero Supabase dependencies**:
  - `calculateDaysRemaining`: Deterministic countdown logic for trial and active subscriptions.
  - `submitPaymentProof`: Transitions subscription status to `pending_verification`.
  - `evaluateAndDispatchReminders`: Multi-tier reminder scheduler (5-day warning and expiry-day notice) with exact-once idempotency guards.
- **`repository.ts`**: Direct Supabase database operations (`SupabaseBillingRepository`).
- **`routes.ts`**: Thin HTTP router resolving `BillingService` from the composition root (`getServices(req).billing`).
- **`index.ts`**: Public barrel module exposing service and `dispatchSubscriptionRenewalReminders`.

## Endpoints
- `POST /api/billing/payment-proof`: Upload payment proof for admin approval.
- `GET /api/billing/status`: View current subscription status, days remaining, and payment history.
