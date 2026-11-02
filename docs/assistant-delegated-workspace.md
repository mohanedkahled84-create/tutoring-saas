# Delegated teacher workspace

The assistant uses `CentrlyApp` and the existing teacher page controllers. The sidebar has the same 17 teacher pages; each is locked unless its view permission is granted. Login remains an independent opaque session for the invited phone and teacher.

## Server boundary

`/api/assistant-access/workspace-api` resolves the current assistant session and the bound teacher server-side. It never issues or returns the teacher JWT. Every route has an explicit page/action policy; administrator, account credential and arbitrary messaging endpoints are absent. Group and student reads are permitted only as dependencies of authorized pages.

All database calls during a delegated request, including service client factories, run through an AsyncLocalStorage client. It uses private invoker/barrier views with check options, rechecking the current session, tenant, permissions and group scope. Embedded relations use the same views. Upserts and the small RPC allowlist have guarded wrappers. Unknown tables, Auth APIs, schemas and unrelated storage paths fail closed. Owner caches and attendance session storage are isolated from assistant state.

## Initial welcome

`portal_onboarding_deliveries` reserves one parent welcome per tenant/normalized phone and one student welcome per account. Reservation and queue insertion are atomic. A worker claims each reserved message once before contacting Meta; ambiguous provider outcomes are not retried automatically. Historical confirmed sends are preserved. Old provider endpoints cannot bypass this rule. Later sharing opens WhatsApp manually and does not claim delivery. Signed inbound credential requests retain their own authentication and cooldown.

## Validation

- Unit policy tests cover page/action restrictions, type spoofing, private transport, redaction and concurrent database context isolation.
- Live isolated-project tests exercise the existing teacher controllers, group/tenant isolation, scoped writes, session creation and immediate permission revocation.
- Transactional SQL checks cover private views, check options, upsert, RPC denial and first-welcome claims without sending messages.
- Browser checks cover 17 pages and session start at widths 320, 390, 768 and 1440, read-only navigation and isolation from cached owner credentials.

Deployment requires the four migrations before the delegated frontend is promoted. The previous frontend/backend can be restored; the receipt history is retained to prevent duplicate welcomes.
