# Stable portal links and teacher subdomain handoff

## HTTPS readiness discovered in production

The apex DNS is hosted at Cloudflare. Although a Vercel wildcard project alias exists, an arbitrary new teacher hostname initially closed TLS; the existing explicitly registered `mr-omar` hostname worked. Registering the exact QA hostname on the same Vercel project issued a valid individual certificate without changing nameservers. See [Vercel wildcard SSL requirements](https://vercel.com/docs/domains/working-with-ssl) and [domain registration](https://vercel.com/docs/cli/domains).

`portal_domain_bindings` is a service-only registry of a tenant's verified current subdomain. Routing requires both publication and a matching verified binding. Publication without verified HTTPS retains the working basic portal; a rename also stays basic until its new domain is verified. A customer cannot approve their own binding through the Data API. This is an operational readiness boundary, not a paid-plan entitlement.

For each new or renamed platform, an operator runs `node scripts/provision-portal-domain.mjs <subdomain>` in an environment containing the service database credentials and the authorized Vercel CLI session. It registers the exact hostname on the existing project, checks real HTTPS `/portal-entry` content, rechecks the current tenant assignment, then records readiness. If certificate issuance is still pending it refuses the binding; rerun after issuance. It does not copy CLI credentials into the backend, change Cloudflare records, move nameservers, or purchase a plan. **Domain provisioning is an explicit operator step in this release; automated backend provisioning is not claimed.**

Apply `20261031020559_verified_portal_domains.sql` and verify/bind existing published domains before deploying the backend that requires this registry. After publication and readiness, the same old link automatically follows the registered current platform. Keep the registry entry synchronized through the provisioning command on a rename.

Existing `/p/:code`, `/s/:code`, query-code and token links continue through their existing resolver and portal identity. After that identity is validated against the current student/tenant, the server resolves the teacher's currently published platform. A missing/inactive platform stays on the canonical Centerly portal. Publication changes the destination of the same inbound link; renaming the subdomain also resolves the current destination, without recreating student records.

This is publication routing, not a new billing entitlement system. Commercial plans remain unchanged. The later entitlement implementation must feed an authorized publication state into this boundary. Existing legacy links are bearer capabilities under the existing resolver contract; this release does not make them family identities or change their authentication model. Parent-family linking remains a separate phase.

## Transfer

`POST /api/public/portal/destination` accepts an existing portal credential and role, validates the identity, and reads publication settings using the verified tenant only. It ignores caller-supplied tenant/subdomain fields. Origin targets are canonical HTTPS hosts with a single validated teacher subdomain; reserved/nested/external hosts are rejected.

If the destination origin differs, issue a cryptographically random 32-byte ticket, valid for 90 seconds. Only its SHA-256 hash and student/tenant/role/destination/expiry and original session expiry are stored in `portal_handoffs`. The service-only table has RLS and no anon/authenticated grants. There are no new SECURITY DEFINER functions. Expired rows are removed on subsequent issuance.

The browser navigates to `https://<teacher>.centerly-eg.com/portal-entry#handoff=<one-time-ticket>`. The fragment is removed before asynchronous redemption and is not sent to the document server. The reusable portal credential is never placed in this new redirect URL. `POST /api/public/portal/handoff` atomically deletes and returns the matching unexpired ticket for the exact Origin. A second or concurrent redemption fails. The resulting signed session retains the original expiry; transfer cannot extend its lifetime. Student existence and current platform origin are rechecked before generating a new portal credential. A platform changed during transit requires reopening the original stable link.

The receiving origin stores the verified session locally. A student enters the existing `/dashboard` design; a parent stays on `/portal-entry` in a branded follow-up view. `/portal-entry` explicitly rewrites to the SPA before teacher login rewrites and uses no-store/no-referrer. It does not redirect parents to the student login. Shared-device student/content caches and the explicit-logout flag are cleared on verified arrival. The advanced page no longer uses a hardcoded student credential/identity, preverification student caches, or global rich-quiz requests; scoped portal materials remain its source.

## Release and verification

Apply `20261030224055_portal_handoffs.sql` and `20261030224934_portal_handoff_session_expiry.sql` in order to the isolated project first; run CI including live tests with zero skips. Local checks and browser tests separately cover the actual SPA/advanced HTML with simulated APIs on two HTTPS origins. Live tests verify basic/publication/rename/deactivation, tenant isolation, parent/student role, wrong-origin rejection, concurrent single use, expiry and denied anon/authenticated Data API access. They clean only their own isolated fixtures.

Production order: snapshot deployed versions and relevant counts; apply the additive service-only migration; deploy compatible backend; deploy frontend; test real temporary fixtures for both roles and publication states; verify cleanup and original counts; record release IDs. No customer publication settings or commercial plans are changed for testing.

Rollback frontend to its previous deployment before removing new backend routes. Leaving the unused service-only ticket table is safe; do not restore hardcoded fallback credentials or broad table grants. A failed transfer displays an actionable reopen-original-link message, with no silent switch to a different student.

References: [Supabase database functions and invoker/privilege boundaries](https://supabase.com/docs/guides/database/functions), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). The current changelog was reviewed; the announced November TLS cipher change does not require an application-protocol change for the current Node runtime.
