# Audit remediation — 2026-10-30

## Scope

This change implements fixes from the teacher-platform audit. It does not add Google authentication, granular assistant permissions, a new plan catalog, campaigns, centers or OMR. Those remain roadmap work.

## Changes

- Bind authenticated student repositories to the verified user's tenant. Privileged ID reads and writes include that tenant. Calls without trusted tenant context retain the caller's RLS client. Require a concrete tenant on teacher student/import routes; protect parent links, notifications and deletes through the same lookup.
- Preserve tenant/search/group predicates in the relational-query fallback. Reject importing into another tenant's group. Password changes require the matching signed portal token and the existing password.
- Upload homework into a separate private bucket. Resolve legacy and current references into short-lived URLs only after authorization, with tenant/material/student path checks. Match upload limits to 25 MiB. Preserve the previous file until a replacement has persisted; persist reviews/deletions before file cleanup.
- Keep the legacy public bucket for public teaching assets; remove its broad anonymous storage policies. Private-file transfer is a separate, checksummed migration with backups and an inventory-only default.
- Fix the builder's undeclared variable. Preserve teacher branding and subject. Remove injected demo students, invented contact/password fallbacks and global tracking data from its rendered records. Expose platform navigation to ordinary teachers while the backend checks publishing eligibility.
- Preserve the existing published legacy platform and its existing entitlement in canonical records before retiring the backend name/email publishing exception. Do not change its price, billing tier or lifecycle status.
- Display load failures through the existing retry screen, retain prior in-memory data, escape rendered errors, distinguish unrecorded reports from recorded zero, exclude missing data from aggregates, and leave no-data students unranked.
- Fix `/portal` short-link resolution, teacher-host detection on local/preview hosts, auth label associations, mobile select sizing, coarse-pointer buttons and unnecessary fetches on the paper-exam coming-soon page.
- Preserve authenticated identity in frontend storage instead of rewriting tenant/role/name based on email. Pin the patched `qs` version and keep the lockfile.
- Add repository/HTTP/renderer regressions, actual Supabase private-storage tests, and authenticated HTTP isolation checks against the dedicated test database. CI fails on skipped tests and blocks fetches to production or other external hosts.

## Verification interpretation

Local tests use isolated inputs and block production networking. Browser checks exercise actual frontend code against simulated API responses, on desktop and mobile, including a failed homework read preserving prior state. They are not a substitute for a live post-deployment check.

Two existing report-test expectations are strengthened to reflect the corrected no-data behavior. No assertion is removed and no new skip is used to conceal a failure. Existing live-suite environment guards remain; CI requires their prerequisites and rejects skipped runs.

## Release order — required

1. Confirm the PR's actual CI result, including all live checks. Record backend and frontend versions; do not infer deployment from a green CI badge.
2. Apply `20261030173319_homework_private_storage.sql` and `20261030175430_preserve_existing_platform_owner.sql`. The private bucket has no browser object policies. The canonical platform migration preserves the published legacy theme and leaves any existing canonical record untouched.
3. Deploy the backend and verify authenticated teacher reads, public portal payloads, signed assignment URLs, replacement uploads, and existing public teaching assets on authorized test data. Verify the correct service key remains configured.
4. Run `scripts/migrate-homework-private.mjs` first without flags. Provide `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and an explicitly matching `HOMEWORK_MIGRATION_PROJECT_REF` through the execution environment, never command text or chat.
5. With a new backup directory outside the repository, run `--apply`. The script writes original references and actual file bytes to that directory, verifies private copies and signed reads, then conditionally updates only matching unchanged references. Nothing is deleted in this mode.
6. Remove public copies only after checking all copies and references: the separate `--remove-public-copies` flag requires `--apply`. Use a new backup directory for another invocation. The script inventories both referenced files and orphan homework-shaped objects, preserving their bytes before removal. It does not remove public `materials/` or `quizzes/` assets.
7. Deploy the frontend; verify the real teacher's saved theme, students, homework and reports, public portals, and coming-soon paper screen. Record results and any remaining limits. Do not announce production completion before these steps.

## Rollback

Do not roll back to code that only understands public homework URLs after converting submission references to private paths. Keep the signing-capable backend or restore a compatible build. Prefer a corrective forward release. Restoring public URLs would reopen the privacy issue and requires a deliberate decision.

The transfer script keeps original references and byte backups outside Git. A failed copy/check stops before deleting source files. A concurrent reference change stops that transfer. The canonical-platform migration retains the legacy row and does not overwrite an existing canonical setting. Do not delete either source record during this release.

## Remaining product/design work

Global subscription lifecycle and capacity enforcement, the authoritative plan model, granular assistant access, lazy route module loading, index/policy optimization, broader parent/student/admin acceptance journeys, and conversion design are separate reviewed work. Supabase advisor warnings are not automatically exploitable findings and must not be resolved through blanket grants/revokes.
