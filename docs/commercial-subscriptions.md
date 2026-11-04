# Commercial subscriptions (policy v1)

Prices are stored as integer piasters. `subscription_plans` and server-priced orders are the checkout authority; never infer a plan from the amount on a payment proof.

| Plan | EGP / 30 days | Active students | Decimal GB | Assistants | Extra student EGP/month |
|---|---:|---:|---:|---:|---:|
| Basic | 249 | 100 | 2 | 2 | 2 |
| Pro | 799 | 300 | 15 | 4 | 1.5 |
| Max | 999 | 500 | 30 | 8 | 1 |

Reference prices 500/1600/2000 are labelled base prices, with launch savings of approximately 50%. They are not represented as historical sales prices. No annual plan is introduced.

All plans include management, multiple-group assignments, reuse, paper exams, manual grades, attendance, collections, family monitoring and team permissions. Pro/Max additionally include the branded teaching platform, external video links and online exams. Max differs through capacity and wallet credit, without invented features.

## Purchases and lifecycle

- New trials are seven days. No trial wallet gift or official welcome sends.
- Add an assistant for 50 EGP/month; add 5 decimal GB for 50 EGP/month.
- Addons and upgrades use the remaining fraction of the actual current period. A first-cycle extra student costs at least 60 piasters per seat. Renewals use full monthly unit prices.
- Existing accounts retain their recorded legacy plan until an explicit approved commercial order. No amount-based automatic migration.
- Quotes last 15 minutes. InstaPay/Vodafone Cash proofs await admin approval. Browser prices cannot set the amount. A proof can settle an order only once. A rejected topup cannot deactivate a subscription.
- Current-period modifications do not alter already-paid future periods. The billing UI lists these periods. Scheduled cancellation/downgrade applies to the first unpaid renewal. An addon cancellation can be undone before renewing.
- Usage is checked before a quote and again at approval. Pending quotes become stale after subscription changes; they require review, never a silent price change.
- Seven days after expiry are read/export only; after that, renew to access business data. Support, authentication and checkout remain available. Inactivity reminders and automatic account deletion are deliberately deferred.

## Wallet and official sends

A delivered Egyptian Utility message costs 1 EGP. Opening WhatsApp manually costs no wallet credit. No monthly message allocation is bundled into a plan.

- Minimum paid topup: 50 EGP. Paid funds persist.
- Pro: 100 EGP initial gift once. Max: 150 EGP total initial gift, then 100 EGP on subsequent paid renewals. Pro-to-Max pays only the remaining initial gift difference. Future-period gifts are unavailable until the period starts; uncommitted expired gifts cannot be spent.
- Durable holds are reserved before queuing, debited on delivered/read, and released on a definite failure/skip. Accepted/uncertain sends remain held pending delivery evidence. Duplicate callbacks are idempotent.
- Delivery callbacks received before HTTP acknowledgement are stored and reconciled at settlement.
- The platform-wide budget is currently 250 unique recipients per rolling 24 hours, shared by official send paths. It is not a per-teacher or midnight-reset allowance. Workers rotate tenants; inactive/trial queues do not occupy the next turn. Deferred welcomes remain eligible without promising a calendar delivery date.
- Welcome claims remain once per new student and per parent at the teacher, independently of the advertising wallet.
- Announcement categories and exact template bodies remain subject to live Utility approval and the existing explicit activation controls. A funded wallet cannot override these checks.

## Quotas, privacy and identity

Active seats count non-archived student records, not enrollments. A second group reuses the same student. Phone canonicalization covers Egyptian local/international prefixes and Arabic/Persian digits. Uniqueness is per teacher; sibling parents and records at different teachers may share numbers. Existing duplicate records are preserved for explicit review.

Storage reads actual object metadata from homework-private, homework-submissions, platform-assets and quiz-images. Uploads check space first; a transaction-locked Storage metadata trigger enforces the final total even during concurrent writes. Embedded-data fallback on a failed quiz-image upload is removed.

Commercial tables/RPCs are service-only. Actor and admin roles are rechecked in SQL. Assistants cannot manage subscriptions or wallet topups. Delegated storage checks are restricted to their tenant and permitted upload size. The read-window helper resides in the unexposed commercial_private schema.

## Validation and release

- Backend TypeScript build.
- Local network-isolated backend tests, including HTTP quote/proof validation and trial/grace/feature decisions.
- `supabase/tests/commercial-subscriptions.sql`: isolated-project rollback tests for prices, gift/hold idempotency, parent phone reuse, cross-tenant denial, 60-piaster minimum, early renewal, cancellation, paper versus online access and authenticated SQL privileges.
- `node scripts/commercial-browser-check.cjs`: local simulated-payment journeys at 320/390/768/1440px. The script requires Playwright and a local Chrome installation. These journeys are not a real provider payment test.
- Parent entry bundle freshness and whitespace checks.
- All nine migrations were replayed from their pre-feature state inside one rollback-only transaction on the isolated project.

Before production activation: pass repository CI/live security checks, verify the current provider rolling-window usage and seed a conservative starting budget for pre-existing sends, apply migrations and deploy the matching backend/frontend, then perform authenticated smoke checks. Do not report a provider delivery or a production deployment from local fixture results. Existing legacy phone conflicts require review, not automatic deletion or merging.
