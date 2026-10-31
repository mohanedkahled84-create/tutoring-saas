# Parent family account

Parents sign in using their registered phone and a separate family password. Every student record currently assigned to that canonical phone appears automatically, across tenants. A student PIN, old single-student capability link, or teacher login never grants family access. Parents do not add children themselves.

## Provisioning and delivery

`POST /api/students/:id/send-family-access` requires staff authentication and tenant context. It reads the recipient from that tenant's student record, never the request body, and sends Meta's existing approved `centerly_student` template with a quick-reply payload identifying that follow-up. This notification contains no password and provisions no credential. Staff receive status only. Existing single-student links and dispatch actions remain available.

When the parent presses the credential button, the backend verifies Meta's `X-Hub-Signature-256` against the exact raw body using `META_APP_SECRET`, then checks the WABA and receiving phone-number ID. Only fresh messages from that exact canonical parent phone can request the family password. The current student/tenant/phone link is checked again before provisioning, and dispatch is restricted to the same verified sender. Legacy credential buttons also work for registered parent phones. Student-only phones receive their own student credentials when unambiguous; ambiguous student records disclose no PIN. No suffix matching is used.

The reply uses Meta's customer-service text response to the parent's fresh inbound message. Staff cannot retrieve or reset the family's password. A second teacher's request resends the same family credential only to the verified parent. Message IDs are deduplicated in persistent rate-limit records; invalid signatures, stale messages and mismatched button scopes cannot issue credentials. Outgoing passwords and raw credential queries are not stored in staff inboxes or application logs. Normal inbound conversations are assigned to a teacher only when the phone match is unambiguous.

Passwords are random 12-digit credentials, bcrypt hashed for login and AES-256-GCM encrypted for resend, with the canonical phone as authenticated associated data. Encryption requires a configured internal secret of at least 32 characters. Rotation of that secret requires a deliberate credential reissue procedure. No passwords or family bearer tokens are placed in URLs, staff responses, or application logs.

**Activation dependency:** Meta's existing sender remains in use; Evolution is not required. `META_APP_SECRET` must be applied to the running backend so replies can be authenticated. The existing utility notification is unchanged in purpose: it contains no password; credentials are returned only to the parent's signed inbound request. No real parent messages are sent during automated testing. Release validation must include a user-designated test number pressing the real Meta button.

## Authorization and navigation

Backend-only family tables have RLS and no browser privileges. Only the pure phone normalizer is executable by authenticated staff, for maintenance of the students expression index. Login attempts have persistent per-phone and IP limits in addition to HTTP throttling. Passwords never fall back to student credentials.

Opaque sessions last 30 days, are stored as SHA-256 hashes on the server and are bound to an approved origin. Each account read rechecks the student's current parent phone. Changing the registered phone or deleting the record removes that follow-up on the next validation. Teacher identity comes from the current published, verified platform; existing subdomains remain in use.

Cross-origin navigation uses 90-second, single-use hashed tickets in the URL fragment. Redemption rechecks membership and publication, mints a derived origin-bound session with the original expiry, and strips the fragment. Logout revokes that device's session chain across teacher origins. Other independently signed-in devices retain their sessions. Local logout is immediate; a failed remote logout reports that remote revocation could not complete.

## Mobile interface and caching

The existing parent dashboard and teacher branding remain. Native 52px selectors appear only for multiple children or teacher records. Exact full names group records for display within an already authorized family, without merging database identities or granting permissions; ambiguous duplicate names remain separate teacher/student record choices with their codes. A single child with a single teacher has no selector. Homework remains monitoring-only: status, deadline, submission time and lateness, with no file/content access.

Only the last selected, allowlisted monitoring response is saved, isolated by the family session hash, expiry and selected student. It paints before background membership validation. Logout/401 clear private data; a 403 removes the saved selection. Old requests cannot repaint after a logout or account switch. Legacy single-student sessions keep their existing cache behavior and bundle path.

## Verification

- `npm run build` and `npm run build:parent-entry -- --check` in `apps/tutoring`.
- `tests/parent-family.test.mjs`: encryption, recipient/tenant scope, delivery failure, credential privacy, rate limits, conditional selectors.
- `tests/parent-family-live.test.mjs`: isolated Supabase fixtures only; injected message delivery; cross-tenant family reads, student-PIN rejection, phone changes, one-use origin-bound transfers, logout, anonymous table/RPC denial.
- `tests/meta-family.test.mjs`: raw-body signatures and webhook aliases, notification transport and readiness, recipient matching, stale/replayed requests, student/family separation and credential privacy. The isolated family live test also exercises notification → signed webhook → family credentials using an injected Meta transport and real scoped database records.
- `node scripts/check-parent-family.cjs`: actual browser entry, mobile layout, selectors, saved-data rendering, failures and session switching, with fixture network responses only.
- Existing parent entry, mobile, student cache, full backend and live security suites remain release gates.
