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


## Messaging decision — manual WhatsApp handoff

The owner changed the follow-up messaging plan on 2026-11-01: student follow-up reports and other new messaging actions open WhatsApp with the recipient and prepared text. The user reviews and sends from WhatsApp. Do not implement Meta delivery, template approval gates, a provider queue or automatic retries for this work. The unused centerly_student_followup_v1 candidate is not a release dependency and must not be wired into follow-up actions. Existing account-delivery integrations are a separate existing workflow; this decision does not silently change account verification.

Follow-up data and recipient selection must still be authorized on the server for the assistant's tenant and assigned groups. Viewing a report and opening WhatsApp require their explicitly granted permissions; opening WhatsApp is not proof that a message was sent or delivered. Label the action «فتح واتساب» and any audit event as opening/preparing, never «تم الإرسال». Do not open conversations automatically or open multiple windows in a loop. A blocked popup offers an explicit link or copy action. No real recipient is contacted during development tests.


## Follow-up reports and manual WhatsApp implementation

The owner can open “متابعة الطلاب وواتساب” from reports or team management. Assistant reports use the same mobile component, with separate messages.view / messages.send grants (off by default). reports.view continues to allow read-only reports. The server derives all metrics, student, group and recipient; it rejects client-supplied phone numbers, message bodies or tenant IDs. Primary and additional group memberships are supported. Lists paginate 30 student/group pairs with name/code search. The date range defaults to the Cairo calendar month and is limited to 366 days.

Attendance counts ended sessions only, and splits present, absent and unrecorded. Quiz reports exclude skipped quizzes, retain zero scores and identify unrecorded results; the latest recorded result uses the quiz date. Homework means materials published in the selected period, with counts for submitted, not submitted, on time, late, no deadline and overdue. Cairo calendar dates determine deadlines; submissions are delivery status rather than a claim that the work was approved. Reports contain no homework file links, credentials or financial data.

Preparing a preview checks current permissions, active account/session/tenant and assigned group scope again. Only this action returns the validated recipient and server-generated text/wa.me URL. An explicit link opens WhatsApp after preview; no provider call, template, queue, bulk window loop or automatic retry is used. A changed recipient/filter clears the previous preview and stale responses are discarded. Preview links expire locally after two minutes and can be regenerated. A copy action handles unavailable WhatsApp/clipboard support. The audit records messages.prepare as a preview request, never sent/delivered, and excludes phone/message bodies.

Existing teacher report buttons now open this manual flow. Legacy report auto-send HTTP endpoints return 410 MANUAL_WHATSAPP_REQUIRED, preventing old clients from silently dispatching or claiming delivery. Existing family/assistant account-verification delivery is a separate integration. The official link format is documented by [WhatsApp](https://faq.whatsapp.com/5913398998672934).

Permission selection enables the required view checkbox when an action is chosen, and clears dependent actions when view is removed. It never grants all groups implicitly; group creation still requires the owner's explicit all-groups selection. Backend validation remains authoritative.


## Payroll and internal-lock correction

Configured work pay now includes assistants awaiting account acceptance: an invitation is a login state, not a suspension of the configured daily/monthly work schedule. Inactive assistants remain excluded. Daily estimates still use the exact calendar weekdays and start date, without attendance entry or a four-week approximation. At 250 EGP/day with Monday/Thursday/Saturday in November 2026, the expected amount is 13 × 250 = 3250 EGP. Team totals use the same eligibility as dashboards/reports.

The owner retired the extra financial PIN across team pay, dashboard, financial reports and settings. Login passwords, tenant isolation and assistant action/group permissions remain enforced. PIN status compatibility returns false; setup, verification and recovery endpoints return 410 without reading/updating PIN storage or sending email. Old cached PIN flags cannot reintroduce dialogs or automatic locks. Optional number masking remains a visual control without a password. Existing inactive hashes are not used; no account credentials are deleted.

Permission labels use the teacher sidebar's exact page names from a shared frontend title map. Quiz setup and student-score access keep separate keys and explicit explanations under the same real page title; renaming grants no additional capability.

## WhatsApp phone verification

An owner can generate a private registration/recovery link for an existing invited or active assistant. Its nonce is in the URL fragment, removed from history before requests and retained only in memory. The server resolves the phone from the invitation/account; neither registration nor acceptance accepts a replacement phone. Generating a new link revokes pending older links but preserves salary, permissions and working account sessions until recovery succeeds.

The assistant explicitly requests a six-digit WhatsApp OTP, confirms it, then supplies their own name and a password for this teacher. An old signed WhatsApp quick reply alone cannot authorize HTTP account acceptance. Successful OTP proof and the resulting one-use, fifteen-minute claim are bound to the invitation and browser origin. OTP hashes use a server-keyed HMAC with purpose and challenge separation. Codes expire in five minutes; five wrong attempts exhaust the challenge; resending waits sixty seconds and invalidates the old challenge. Persistent per-IP/per-phone limits and an atomic shared daily budget limit delivery attempts. No code, password or claim is stored in browser storage; only the existing opaque assistant session is retained.

Teachers can confirm their saved profile number from Settings → Profile → «تأكيد رقم واتساب». The backend derives their user and tenant from authentication and reads the saved phone. Changing that phone invalidates its confirmation. This does not replace the existing email verification or impose a new login gate on existing teachers.

Teacher and assistant OTPs share `centerly_phone_verification_v1` (`ar`, **AUTHENTICATION**, five-minute expiry, security recommendation, copy-code button). The exact template must be APPROVED with the correct category/language before any send. Codes are never sent through Utility invitation/report templates; a timeout is reported as uncertain and never retried automatically. The UI reports blocked delivery honestly. Follow-up messages continue to open WhatsApp manually.

**External blocker, 2026-11-01:** Meta rejected creation of this Authentication template with code 10 / subcode 2388185: “This WhatsApp business account does not have permission to create message template”. No OTP template was created and no real OTP was sent. Isolated tests use a fake gateway and cannot establish live delivery. Enablement requires the connected WABA to be allowed to create this template and the template to be approved. Do not switch to a different message category to evade this restriction.

### Akedly SMS delivery

The owner selected prepaid Akedly SMS while Meta Authentication remains unavailable. Configure `PHONE_OTP_PROVIDER=akedly`, `AKEDLY_API_KEY`, `AKEDLY_PIPELINE_ID` and `PHONE_OTP_DAILY_LIMIT` (default 50; initial trial rollout should use 10). Keep credentials only on tutoring-backend. Use an active Live V1.2 Authentication pipeline, SMS enabled, Egypt allowed and channel selection enabled for `sms`; disable other routing channels. `channel:sms` is explicitly supplied; an unsupported selection fails without falling back to another channel or API version. Never use a Utilities pipeline to send OTPs. The integration ignores client phone/pipeline/provider-transaction overrides and uses the saved invitation/profile number.

Akedly challenge/PoW and any required Turnstile checks run before sending. A five-minute server-signed context binds the provider's challenge to the invitation/user, purpose, origin, phone and configured pipeline. The pinned `@akedly/shield` 1.1.0 SDK is bundled locally; PoW runs in a Web Worker. Rebuild/check it using `node scripts/build-phone-shield.cjs [--check]`. CSP permits the worker and the fixed Cloudflare challenge origin. Never bypass enabled provider checks or enable Dev Mode on a live account verification flow.

The server generates the six-digit code, stores only its HMAC and sends it as Akedly's custom OTP. Every entered code must also pass Akedly's V1.2 verify endpoint before local account acceptance. The private `phone_otp_provider_attempts` record binds provider IDs to the currently valid local challenge; neither ID is accepted from the browser. Expiry is the shorter of local/provider TTLs. Five provider attempts are reserved atomically; resending invalidates the old local challenge. A saved provider confirmation is bound to the entered code's HMAC for local-commit retry recovery. Generic HTTP success, `verified:false`, a different transaction, callbacks, or simulation flags cannot activate an account. The integration does not trust or need a webhook to grant access.

The response says that the provider accepted an SMS request, not that the SMS was delivered. Provider timeouts, missing transaction IDs or unknown channel results cause an honest failure without an automatic retry; a later request must wait through the local cooldown. API secrets in challenge URLs and OTP submission fields are removed from telemetry; local-variable capture is disabled. Follow-up reports and manual WhatsApp sharing are unchanged.
