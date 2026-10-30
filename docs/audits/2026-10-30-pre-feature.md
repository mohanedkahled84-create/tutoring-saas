# Remaining pre-feature audit repairs

This release closes existing audit defects before new features. Commercial plans, prices, limits and subscription lifecycle behavior are explicitly excluded at the owner's request. Google login, granular team invitations, dashboard redesign and marketing work are separate features.

## Changes

- Use the stored server-verified `users.role` for administrative authorization. Remove automatic elevation by email and frontend `is_superadmin` shortcuts. Existing production administrators already have the `admin` role.
- Limit authenticated profile updates to `full_name`, `phone` and `subject`. Identity, role, membership and PIN state writes remain backend-service operations. Restrict direct profile reads to safe columns; use the self-only profile RPC for the PIN-existence boolean instead of exposing its hash.
- Resolve tenant identity from the current profile. Queue read access uses that identity or the stored admin role, without global/default visibility or reliance on stale tenant claims. Wrap stable identity checks as statement-level subqueries in the affected policies.
- Load staff workspace components/actions on authenticated entry, preserving action registration order and cross-page operations. Public entry screens retain their own dependencies. Module-load failure presents an accessible retry/reload state and preserves the session.
- Propagate primary screen read errors into the existing retry state instead of fabricated empty lists, disconnected states or invented admin totals. Preserve previous student and payment-proof records. Bound route-level session-refresh retries; alternate legacy endpoints are tried only for a 404.
- A failed assistant-table read no longer becomes a successful empty list after all fallbacks fail.

## Verification

Browser checks exercise the actual baseline and new frontend, against simulated API responses with external requests blocked. Initial public JavaScript requests decreased from 63 to 23, and raw uncompressed response bytes from 2,799,115 to about 688,346. This is a payload comparison, not a claim of a 75% reduction in wall-clock loading time.

Desktop/mobile checks cover actual login transitioning into the deferred workspace, 13 teacher routes, legacy email not elevating an owner, retained records on failed reads, successful retry, admin navigation, and failed workspace download followed by successful reload without clearing the session. Existing builder, saved branding, homework and no-data report regressions remain covered.

The new isolated live test checks role/membership/PIN mutation rejection, safe profile editing, self-only RPCs, hidden PIN credentials, current admin/assistant HTTP authorization, global dispatch queue isolation, real student/parent login and portal access, and portal password change/re-login. It requires the dedicated test project and cleans up its own fixtures. Production/external networking remains blocked in CI.

## Release order

1. Apply the migration to the dedicated test project and pass CI, including all live checks, with no skips.
2. Record current production versions, user grants and function definitions. Verify existing administrators retain their stored roles.
3. Deploy the compatible backend **before** the production migration. It accepts both the old hash-bearing profile RPC and the new `has_security_pin` boolean, while returning only the boolean to clients.
4. Apply `20261030212328_protect_user_security_fields.sql`. Profile editing keeps the listed safe columns. Recheck grants and the self-only RPC.
5. Deploy the frontend, verify real authenticated fixture journeys and public pages, remove the fixtures, and record the release.

Do not roll back to the old backend's direct selection of restricted PIN columns after this migration. Prefer a forward fix; restoring broad user-column grants would reopen the privilege boundary.

## Reviewed diagnostics

The four service-only tables intentionally retain RLS with no user policies. Six self-context SECURITY DEFINER helpers are not automatically converted to INVOKER: their role checks, self-only profile contract and fixed search paths are reviewed/tested. No index is dropped merely because the advisor has not observed its use. The sampled legacy platform query already uses the tenant index, filters only 14 extra rows, and executed in about 5.7 ms; historical statement averages do not justify a speculative region move or blanket index changes.

Supabase's built-in leaked-password protection is unavailable on the project's Free organization plan; official documentation requires Pro or above. No paid upgrade is part of this release. The application retains its password-strength and authentication-rate checks; this release does not claim leaked-password protection is enabled.
