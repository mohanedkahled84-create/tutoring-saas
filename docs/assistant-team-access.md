# Assistant team access

Teachers invite a WhatsApp number and configure page actions, group scope and pay. The assistant confirms the number through the signed Meta webhook, then chooses a name and password. Phone numbers are unique within a tenant, so the same number can have separate credentials at another teacher.

## Rollout status

The implementation is in PR #31. The owner authorized publishing the workspace while WhatsApp approval is pending. A separate manual-record action preserves the existing assistant/pay setup without creating an account or sending a message. Account invitations continue to require live APPROVED + UTILITY metadata.

Meta template `centerly_assistant_invitation_v1` (`ar`) was rejected as UTILITY with `INCORRECT_CATEGORY`. Sending checks the live template metadata and requires both `APPROVED` and `UTILITY`. There is no Marketing fallback. Keep the manual-record path available while invitation delivery is unavailable. Publishing the workspace does not imply that WhatsApp invitations are active.

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

1. Apply all assistant migrations to an isolated Supabase project and run the isolated live suite.
2. Confirm TypeScript, unit/security tests and responsive browser checks. Live fixtures must never target production.
3. Resolve the Meta Utility template rejection and verify its approved category.
4. Apply the final migrations, deploy backend before frontend, and verify the new route and existing portal paths. Run a real invitation only on an explicitly designated recipient.


## Owner activity and pay privacy

The team screen stays available while the salary PIN is locked. Names, access controls and activity can be reviewed; salary amounts and edit inputs stay concealed. Saving a permission-only form omits pay fields and retains the configured salary, model, weekdays and start date on the server. Creating a new invitation with pay setup still requires revealing/unlocking pay. Pay dialogs close on automatic lock, manual lock or hiding financial numbers.

The owner activity log supports a member filter and paginated history. Assistant writes capture actor/target names and the changed values in the same transaction, using explicit field allowlists that exclude passwords and private homework links. Actor names survive assistant deletion. Direct owner writes are not attributed to an assistant, and unchanged saves do not create duplicate change events. The owner API sanitizes detail fields again; assistants cannot access it.

### Template copy under review

The user rejected technical account-record wording. Meta subsequently recategorized the simple invitation `centerly_assistant_team_invite_simple_v1` as Marketing while pending; that unused candidate was deleted. The replacement requested by the user is `centerly_assistant_account_added_v1` (`ar`, Meta ID `2005026400178344`), last checked Pending / Utility. Its copy says the recipient was added as an assistant and asks them to complete their name and password; no technical record references are shown. Do not use `centerly_staff_access_status_v1`, even if Meta approves its technical copy. Runtime selection now targets this exact candidate with one body variable (teacher name) and the verified-phone quick reply. Every send checks live approval and Utility classification; Pending, Rejected and Marketing variants remain blocked. Approval must still be verified before release.


## Invitation and workspace reliability

Reinvitation omits pay fields and the backend skips pay validation for existing records; the SQL transaction preserves their current pay and calendar schedule. New invitations still require valid pay setup. Owner create/edit/invite forms block duplicate submission and restore controls after an error. The team list distinguishes expired, revoked, blocked and sent invitations, including recovery invitations for an already active account.

Stored assistant sessions open directly through the identity endpoint rather than waiting for a redundant public workspace lookup. The teacher name stays in the header and login screen after logout. Requests have a 15-second timeout with retry guidance; writes never retry automatically because a timed-out save may already have committed. Attendance selection remains usable during loading and stale responses cannot replace a newer selection. Authorization expiry closes the editor and clears the local session. Expired invitation links offer a path back to login; the claim fragment is removed before network requests. No student data is cached in persistent browser storage.

Internal browser checks at 320/390/768px cover delayed attendance responses, offline recovery, session expiry during save, identity retention, expired claims and repeated invitation submission. Existing 320/390/768/1280 workspace checks and owner payroll/activity checks remain applicable. The owner authorized rollout with invitation delivery blocked pending approval and the separate manual-record path retained. No assistant invitation has been sent to a real recipient.


## Separate grade permissions

Grade viewing and entry have their own grades.view / grades.edit permissions, initially off for all existing assistants. Quiz setup permissions do not grant access to student results. The grade roster includes primary and additional group memberships and distinguishes an unrecorded result (null) from zero. The server derives the quiz, group, tenant and maximum score from authorized records, enforces the score range and excludes skipped quizzes from editing. An assistant cannot change quiz metadata, student membership or the maximum score through this API. Repeated saves use the teacher panel's existing idempotency key and do not create duplicate results or change-history entries. A changed result is marked pending for message delivery without sending a message automatically. Before/after results appear in owner activity history.

The standalone assistant route must point to /apps/web/assistant.html in repository-root deployments. apps/web/vercel.json also retains the route for web-root deployments; both configurations have regression coverage. Cached dependency imports and the repository-root bootstrap are versioned for the new permission controls.


## Actual student collections

Actual receipts use a separate service-only ledger; attendance-based revenue estimates are never backfilled as payments. Owners can open the ledger from the team screen behind the existing financial privacy controls. The independent collections.view / collections.create permissions grant assistants access only to their assigned groups. No edit, void or deletion permission is exposed to assistants. The owner corrects a receipt by voiding it with a reason and recording a replacement; the original amount and actor remain visible, and voided amounts are excluded from totals.

Every receipt has a client-generated request UUID. Concurrent retries return the same receipt; reusing a key with different values returns a conflict. Retrying a voided receipt cannot reactivate it. The browser confirms the student, group, amount and method before saving and retains the same request UUID after a failed/uncertain response. Both the receipt and assistant activity capture the actor. Student/group deletion preserves name snapshots and money history; only the owner can see receipts from deleted groups.

Views have server pagination, Cairo calendar date filters and a total for the complete filter rather than only the current page. Student lookup is scoped by group, supports name/code search and returns at most 500 matches. New permissions are off by default; granting attendance or student access does not grant collections. The new ledger does not change the existing attendance-based revenue calculations or claim that old attendance was paid.
