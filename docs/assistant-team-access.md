# Assistant team access

Teachers invite a WhatsApp number and configure page actions, group scope and pay. The assistant confirms the number through the signed Meta webhook, then chooses a name and password. Phone numbers are unique within a tenant, so the same number can have separate credentials at another teacher.

## Rollout status

The implementation is in PR #31. It has not been deployed to production.

Meta template `centerly_assistant_invitation_v1` (`ar`) was rejected as UTILITY with `INCORRECT_CATEGORY`. Sending checks the live template metadata and requires both `APPROVED` and `UTILITY`. There is no Marketing fallback. Do not replace the existing production assistant creation flow until the invitation delivery dependency is resolved and the full live checks pass.

## Boundaries

- Dedicated opaque, hashed, origin-bound sessions expire after 12 hours. They cannot authenticate to staff Supabase JWT routes. Browser session storage separates each teacher's session and stores no student records.
- Accounts, invitations, sessions and audit rows are service-only, with RLS enabled and anonymous/authenticated grants revoked. Workspace permissions and tenant/group scope are checked in the same SQL transaction as each operation.
- New accounts default to no permissions or group scope. Teacher-only functions include team management, subscription, financial configuration, permanent deletion and moving student memberships.
- Initial pages: groups, students, session schedule, attendance, homework review, linked materials, quizzes and attendance reports. Only implemented actions are offered. Views currently return at most 500 rows and state that limit in the interface.
- An existing assistant record and its salary can be linked without deleting it. Records connected to a legacy staff login require an explicit credential migration first; they cannot silently retain a broader JWT login beside the new permissions.
- The initial notification contains no password or acceptance credential. Its quick reply is bound to the invited phone. The signed reply creates a single-use acceptance link lasting 15 minutes. Disabling access revokes pending invitations and existing sessions.
- Password reset uses another verified invitation and only affects the selected teacher account. Neither the owner API nor staff logs receive passwords or acceptance links.

## Pay

Daily pay is an automatic calendar estimate for the selected month: rate × selected weekdays, counted inclusively from the work start date. It requires no assistant attendance. Cairo determines the current month; calendar arithmetic uses dates rather than 24-hour intervals across DST. Monthly legacy rates remain fixed. Per-session pay counts ended sessions in the assigned scope, including tenant-owned legacy sessions without a teacher ID. Financial views use the same server result and selected report month.

These are estimates, not a payment ledger or historical salary snapshots. Changing a rate changes the estimate; existing attendance, student and assistant records remain intact.

## Release checks

1. Apply both migrations to an isolated Supabase project and run the isolated live suite.
2. Confirm TypeScript, unit/security tests and responsive browser checks. Live fixtures must never target production.
3. Resolve the Meta Utility template rejection and verify its approved category.
4. Apply the final migrations, deploy backend before frontend, and verify the new route and existing portal paths. Run a real invitation only on an explicitly designated recipient.
