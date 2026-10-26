# 🚀 Centrly — Developer & Codex Master Handover Guide

> **Notice for Codex / AI Coding Assistants:**  
> This file is the single source of truth for understanding the architecture, features, security standards, API catalog, and deployment pipelines of **Centrly** (`https://centerly-eg.com`). Read this completely before writing or modifying any code.

---

## 📌 1. Project Overview & Mission

**Centrly (سنترلي)** is a production-grade, multi-tenant EdTech SaaS platform designed specifically for private tutors, educational centers, students, and parents in Egypt and the MENA region.

### Core Stack
* **Frontend:** Vanilla modern ES Modules SPA (`apps/web/`) deployed on **Vercel** (`centerly-eg.com`, `centerly-platform.vercel.app`). Clean component architecture, zero heavy frontend framework overhead, ultra-fast initial load.
* **Backend:** Node.js (v22+) + Express + TypeScript (`apps/tutoring/`) deployed on **Railway** (`tutoring-backend-production-c8dd.up.railway.app`). Clean Architecture & Feature-Sliced Design.
* **Database & Auth:** **Supabase** (PostgreSQL 15+, Row Level Security, RPC functions, Auth service) hosted at `https://ofaraxqrpcdiregxjyyb.supabase.co`.
* **Version Control & CI/CD:** GitHub repository `mohanedkahled84-create/tutoring-saas` (branch: `main`). Automated deployments to Vercel and Railway on git push.

---

## 🏗️ 2. Repository Architecture & Layout

```
Ai business/
├── apps/
│   ├── tutoring/                     # Backend API (Express + TypeScript)
│   │   ├── src/
│   │   │   ├── features/             # Self-contained domain modules
│   │   │   │   ├── activity-log/     # Audit logging & center financials
│   │   │   │   ├── admin-ops/        # Centrly HQ Superadmin operations
│   │   │   │   ├── assistants/       # Teacher assistants & permission delegation
│   │   │   │   ├── attendance/       # Live attendance, barcodes & offline sync
│   │   │   │   ├── auth/             # Login, register, profile, settings
│   │   │   │   ├── billing/          # Plans, payment proofs, coupons, webhooks
│   │   │   │   ├── business-dashboard/# Teacher financial metrics & KPIs
│   │   │   │   ├── centers/          # Center halls, teachers & settlement logs
│   │   │   │   ├── groups/           # Classroom batches & student rosters
│   │   │   │   ├── homework/         # Homework assignments, student uploads, grading
│   │   │   │   ├── materials/        # PDFs, notes & study materials
│   │   │   │   ├── quizzes/          # Quiz grades, scores & WhatsApp dispatch
│   │   │   │   ├── reports/          # Attendance & academic performance reports
│   │   │   │   ├── risk-watchlist/   # Predictive at-risk students engine
│   │   │   │   ├── sessions/         # Live classroom sessions & rent calculations
│   │   │   │   ├── students/         # Student directory, portal auth, bulk import
│   │   │   │   ├── telemetry/        # Performance & error metrics
│   │   │   │   └── whatsapp-notifications/ # WhatsApp bot, templates, circuit breaker
│   │   │   ├── shared/               # Cross-cutting middleware, auth, errors, rate limits
│   │   │   ├── app.ts                # Express app configuration & middleware pipeline
│   │   │   ├── composition.ts        # Composition Root (Dependency Injection)
│   │   │   ├── server.ts             # Server entrypoint
│   │   │   └── supabase.ts           # Supabase client factory (public & scoped)
│   │   ├── tests/                    # 341 in-memory unit/integration tests (Fake Repos)
│   │   └── package.json
│   └── web/                          # Frontend SPA (Vanilla JS + RTL CSS + Icons)
│       ├── src/
│       │   ├── components/           # UI Component Views (Dashboard, Billing, etc.)
│       │   ├── services/             # api.js, auth.js
│       │   ├── styles/               # tokens.css, main.css
│       │   ├── utils/                # icons.js, escapeHtml.js, studentBarcodeCard.js
│       │   └── app.js                # Main Single Page App controller & router
│       ├── index.html                # Entrypoint with cache-busting versioning (v=5.1.0)
│       ├── favicon.png               # Official Arabic "س" Logo
│       └── vercel.json               # Vercel rewrites & routing rules
├── supabase/
│   └── migrations/                   # SQL migrations, RLS, triggers & RPC functions
├── railway.json                      # Railway deployment configuration
├── vercel.json                       # Root Vercel routing
└── Procfile                          # Deployment start command
```

---

## 👥 3. User Roles & Platform Features

| Role | Context | Capabilities & Permissions |
| :--- | :--- | :--- |
| **`admin`** | Centrly HQ (Founder) | Full access to Superadmin Dashboard. Views real cash collected, approved payment proofs, onboarding radar, expected normalized MRR, extends client trials (+7 days), tests n8n/WhatsApp webhooks, purges test data. |
| **`owner`** (Teacher) | Tenant-scoped | Manages students, groups, live sessions, physical/camera barcode attendance, homework assignments, quizzes, WhatsApp parent alerts, study materials, billing upgrades, assistants. |
| **`assistant`** | Tenant-scoped | Delegated staff member with granular permission flags (`can_scan_attendance`, `can_manage_students`, `can_view_financials`, `can_manage_quizzes`). |
| **`center_owner`** | Educational Center | Manages center halls/rooms, approved teachers, group schedules, hall rent settlements (fixed rent vs student revenue split), and reception check-in. |
| **`student` / `parent`** | Unified Portal | Public portal (`/portal` or subdomain). Authenticated with Phone Number + 6-digit PIN. Views student attendance card (Barcode 128), homework grades, quiz scores, and payments. |

---

## 🛡️ 4. Security Standards & Engineering Rules (STRICT)

Codex must **NEVER** bypass or weaken any of the following security rules:

### Rule 1: Multi-Tenant Data Isolation
* Every table except `tenants` and system-wide tables has a `tenant_id` UUID column.
* **Backend Requirement:** Every query, insert, update, or delete in `apps/tutoring` must be explicitly scoped to `tenantId = req.user.tenant_id` (except when `req.user.role === 'admin'`).
* **Database Requirement:** PostgreSQL Row Level Security (RLS) is active on tables. Service role is only used in authorized server-side contexts.

### Rule 2: Protection Against Privilege Escalation
* PostgreSQL trigger `trg_prevent_self_privilege_escalation` on `public.users` strictly rejects any `UPDATE` that modifies `role`, `tenant_id`, `teacher_id`, or `assistant_id` unless executed by a verified admin or `service_role`.
* When writing migrations or maintenance scripts, never disable this trigger without re-enabling it immediately in the same transaction.

### Rule 3: Zero Database Imports in Domain Services (Clean Architecture)
* Files inside `features/<name>/service.ts` must contain **pure business logic**.
* **NEVER** import `@supabase/supabase-js`, `supabase.ts`, or execute SQL in `service.ts`.
* All persistence is accessed through the `I<Feature>Repository` interface defined in `features/<name>/types.ts`.
* Repositories live in `features/<name>/repository.ts` and are wired in `composition.ts`.

### Rule 4: ESM & TypeScript Rules (NodeNext)
* In `apps/tutoring/src/`, all local relative imports in TypeScript files must include the `.js` extension (e.g., `import { authService } from "./service.js";`). This is mandatory for Node.js ESM compatibility.

### Rule 5: Input Validation & Sanitization
* All incoming request payloads (`req.body`, `req.query`, `req.params`) must be validated using **Zod** schemas via `validateBody(schema)` and `validateQuery(schema)`.
* Every string rendered into the DOM in `apps/web/` must pass through `escapeHtml(...)` to eliminate Cross-Site Scripting (XSS).

### Rule 6: WhatsApp Anti-Ban & Circuit Breaker Engine
* Graduated Daily Warm-Up: New WhatsApp connections have a graduated message quota to protect teacher phone numbers.
* Jitter Delay: Messages are sent with randomized delays (e.g., 2.5s – 5.5s) to simulate human pacing.
* Spintax Rotation: Message templates rotate random synonym variations (e.g., `{أهلاً|مرحباً|السلام عليكم}`) so consecutive messages are never identical.
* **Circuit Breaker:** If 3 consecutive delivery errors occur, the tenant's WhatsApp queue is **automatically paused for 5 minutes** to prevent account bans.

### Rule 7: Financial PIN & Sensitive Action Guard
* Critical financial actions (e.g., changing teacher revenue splits, viewing net profit, deleting records) require entering a 4-digit or 6-digit PIN hashed via `bcryptjs` (`financial_pin_hash`).

### Rule 8: Client-Side Routing vs. Server-Side Security Boundary
* In `apps/web/src/services/auth.js`, local overrides exist purely for frontend UI rendering convenience (e.g. routing the founder's verified email directly to the SuperAdmin HQ view `BusinessOwnerDashboard.js`).
* **Absolute Security Boundary:** The backend does **NOT** trust client-side local storage or modified roles. All protected API requests (`/api/admin/*`, `/api/sessions/*`, etc.) require a valid Bearer JWT or httpOnly cookie, which is cryptographically verified by the server (`authenticateUser`) and enforced by Supabase Row-Level Security (RLS) policies. Modifying local storage on the client provides zero backend escalation.

---

## 📡 5. Complete API Catalog

Base URL (Production): `https://tutoring-backend-production-c8dd.up.railway.app/api`  
Base URL (Local): `http://localhost:3000/api`

> ℹ️ **Infrastructure Note on Railway:**  
> The backend operates as a single unified service: **`tutoring-backend`** on Railway (configured via `railway.json` and `Procfile`).  
> Any other services appearing in the Railway dashboard (e.g., historical workers or n8n containers) are dormant/offline legacy services. The entire platform in production relies solely on `tutoring-backend`.

### 1. Authentication & Session (`/api/auth`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Public | Teacher / Center owner registration with 14-day trial & founder alert |
| `POST` | `/api/auth/login` | Public | Email/Phone/Password login, returns JWT token & user profile |
| `POST` | `/api/auth/logout` | Yes | Invalidates session and clears cookies |
| `POST` | `/api/auth/refresh` | Public | Silent token refresh using refresh token |
| `GET` | `/api/auth/me` | Yes | Returns current authenticated user and tenant context |
| `POST` | `/api/auth/verify-email` | Public | Verifies 6-digit OTP email code and activates session |
| `POST` | `/api/auth/resend-verification` | Public | Resends OTP verification code with rate-limit cooldown |
| `POST` | `/api/auth/forgot-password` | Public | Sends password recovery link to user email |
| `POST` | `/api/auth/reset-password` | Token | Resets user password using reset token |
| `POST` | `/api/auth/change-password` | Yes | Changes password for authenticated user |
| `POST` | `/api/auth/validate-password` | Public | Validates password complexity policy |

### 2. Tenant Settings & Security PIN (`/api/settings`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/settings` | Yes | Retrieves tenant workflow settings & teacher profile |
| `PUT` | `/api/settings` | Owner / Admin | Updates workflow settings (homework submission, notifications) |
| `GET` | `/api/settings/security-pin` | Yes | Checks whether financial security PIN is configured |
| `POST` | `/api/settings/security-pin` | Yes | Sets or updates financial security PIN (requires old PIN or OTP) |
| `POST` | `/api/settings/verify-pin` | Yes | Validates PIN against bcrypt hash with brute-force lockout guard |
| `POST` | `/api/settings/security-pin/request-reset` | Yes | Dispatches 6-digit OTP code to registered email for PIN reset |
| `DELETE` | `/api/settings/security-pin` | Yes | Removes financial security PIN (requires verification) |

### 3. Superadmin / Centrly HQ (`/api/admin` — Role `admin` only)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/overview` | High-level metrics: total tenants, active, trials, total cash, sessions |
| `GET` | `/api/admin/tenants` | Detailed list of all tenants, subscriptions, limits, and students count |
| `PUT` | `/api/admin/tenants/:id` | Override tenant subscription tier, dates, or student limits |
| `POST` | `/api/admin/tenants/:id/extend-trial` | Instant +7 days trial extension |
| `GET` | `/api/admin/payment-proofs` | List all submitted payment proofs (pending, approved, rejected) |
| `POST` | `/api/admin/payment-proofs/:id/approve` | Approve payment proof, activate subscription, record MRR |
| `POST` | `/api/admin/payment-proofs/:id/reject` | Reject payment proof with reason |
| `POST` | `/api/admin/test-webhook` | Sends a live test alert to n8n / admin webhook |
| `POST` | `/api/admin/purge-test-data` | Deletes test accounts while safely preserving founder & real clients |

### 4. Billing & Subscriptions (`/api/billing`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/billing/status` | Yes | Current tenant subscription status, limits, days remaining |
| `POST` | `/api/billing/payment-proof` | Yes | Submits bank/Instapay transfer screenshot and reference |
| `POST` | `/api/billing/coupons/validate`| Yes | Validates coupon codes (e.g., `CEN100` for 100% off) |

### 5. Students Directory (`/api/students`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/students` | Yes | List students (supports `search`, `group_id`, `status` filters) |
| `POST` | `/api/students` | Yes | Add new student (auto-generates 6-digit portal password) |
| `GET` | `/api/students/:id` | Yes | Student details, attendance history, balance, portal code |
| `PUT` | `/api/students/:id` | Yes | Update student profile, parent phone, or notes |
| `DELETE` | `/api/students/:id` | Yes | Soft-delete student |
| `POST` | `/api/groups/import` | Yes | Bulk CSV/Excel student roster import |
| `GET` | `/api/students/barcode-sheet` | Yes | Generates ready-to-print A4 PDF barcode sheet |

### 6. Groups & Batch Schedules (`/api/groups`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/groups` | Yes | List all academic groups with student count and schedules |
| `POST` | `/api/groups` | Yes | Create group (grade level, subject, session pricing, hall) |
| `GET` | `/api/groups/:id` | Yes | Group details, roster, and scheduled sessions |
| `PUT` | `/api/groups/:id` | Yes | Update group schedule or pricing |
| `DELETE` | `/api/groups/:id` | Yes | Delete or archive group |

### 7. Classroom Sessions & Live Attendance (`/api/sessions`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sessions` | Yes | List sessions by date range, group, or status |
| `POST` | `/api/sessions` | Yes | Start a new live classroom session (`in_progress`) |
| `GET` | `/api/sessions/:id` | Yes | Session details, live attendance roster, revenue split |
| `POST` | `/api/sessions/:id/scan` | Yes | Instant barcode/QR check-in for a student |
| `POST` | `/api/sessions/:id/attendance`| Yes | Manual attendance toggle (present / absent / exempt) |
| `POST` | `/api/sessions/:id/offline-sync`| Yes | Flushes queued offline attendance scans |
| `POST` | `/api/sessions/:id/end` | Yes | Finalizes session, calculates financials, dispatches alerts |

### 8. Homework & Quizzes (`/api/homework`, `/api/quizzes`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/homework` | Yes | List published homework assignments |
| `POST` | `/api/homework` | Yes | Publish new homework with deadline & questions |
| `GET` | `/api/homework/:id/submissions` | Yes | List student submissions with uploaded photos |
| `POST` | `/api/homework/:id/grade` | Yes | Grade student homework submission |
| `GET` | `/api/quizzes` | Yes | List quizzes and scores |
| `POST` | `/api/quizzes` | Yes | Record quiz score and trigger WhatsApp parent alert |

### 9. WhatsApp & Messaging (`/api/whatsapp`, `/api/templates`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/whatsapp/status` | Yes | QR connection status, battery, warm-up pacing tier |
| `GET` | `/api/whatsapp/qr` | Yes | Generates QR code to link teacher's WhatsApp device |
| `POST` | `/api/whatsapp/disconnect` | Yes | Unlinks WhatsApp device |
| `GET` | `/api/templates` | Yes | List spintax message templates |
| `PUT` | `/api/templates/:id` | Yes | Customize notification wording |
| `POST` | `/api/whatsapp/broadcast` | Yes | Send custom announcement with anti-ban pacing |

### 10. Public & Student Portal (`/api/public`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/public/portal/login` | Public | Student/Parent login using Phone + 6-digit PIN |
| `GET` | `/api/public/portal/me` | Portal Token | Student dashboard, attendance history, homework grades |
| `POST` | `/api/public/homework/upload` | Portal Token | Student uploads homework photos |
| `GET` | `/api/public/register/:code` | Public | Student self-registration form via teacher link |

### 11. Health & Diagnostics (`/health`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health/ping` | None | Instant uptime check (Railway deployment healthcheck) |
| `GET` | `/health` | None | Detailed database, memory, and services health |

---

## ⚙️ 6. Development, Testing, and Deployment Workflow

### 1. Running Backend Tests
The backend has **364 automated unit and integration tests** verifying all business rules, security boundaries, rate limits, and billing calculations:
```bash
cd apps/tutoring
npm test
```
> ⚠️ **Codex Requirement:** Every new backend feature or bugfix must pass all 364 tests (`pass 364, fail 0`). Never commit code that breaks existing tests.

### 2. Verifying TypeScript Compilation
```bash
cd apps/tutoring
npm run build
```
This runs `tsc` and confirms all types, interfaces, and module imports are valid.

### 3. Frontend Script Check & Version Bumping
The frontend is a vanilla JavaScript SPA. Always verify JavaScript syntax before pushing:
```bash
node --check apps/web/src/app.js
node --check apps/web/src/components/BusinessOwnerDashboard.js
```
Whenever making changes to frontend files, **bump the version parameter** in `apps/web/index.html` (e.g., `src="./src/app.js?v=5.2.0"`) and in module imports to prevent browser caching issues for existing users.

### 4. Dedicated Supabase Test Database & CI Secrets
To run live security tests (`audit-c01-rls.test.mjs`, `audit-c02-rpcs.test.mjs`, `security-lockdown-verification.test.mjs`) without touching the production customer database:
1. **GitHub Repository Secrets required by `.github/workflows/ci.yml`:**
   * `SUPABASE_TEST_URL`: The API URL of the dedicated test Supabase project (e.g. `https://xxx.supabase.co`).
   * `SUPABASE_TEST_ANON_KEY`: The publishable anon key for the test Supabase project.
   * `SUPABASE_TEST_SERVICE_ROLE_KEY`: Used only against the isolated test project to confirm expected RPCs exist before checking that anon is denied. It must never be a production key.
   * The non-secret `SUPABASE_TEST_PROJECT_REF` is set directly in the workflow and must match the test URL.
   * The live security tests require `SUPABASE_TEST_ENV=isolated` and fail when the dedicated test secrets are missing. They never fall back to production `SUPABASE_URL` or `SUPABASE_ANON_KEY`.
2. **Automated Migration Setup:**
   Use a fresh dedicated test project. Set `SUPABASE_TEST_DB_URL`, `SUPABASE_TEST_PROJECT_REF`, `SUPABASE_TEST_ENV=isolated`, and `APPLY_TEST_MIGRATIONS=true`, then run:
   ```bash
   npm run setup:test-db
   ```
   The script checks the database host against the test project ref, rejects the configured production ref, requires Supabase's real managed Auth schema, applies migrations one at a time, and stops on the first failure. It does not create fake Auth tables or continue past failed migrations. It verifies RLS on every public table and does not claim production schema parity.

### 5. Git Deployment (Vercel + Railway)
Pushing to the `main` branch of GitHub automatically triggers:
1. **GitHub Actions CI:** Runs the backend build and full test suite, including live security tests via `.github/workflows/ci.yml`.
2. **Railway:** Builds and deploys the backend API via Nixpacks (`railway.json`).
3. **Vercel:** Deploys the web client instantly.

---

## 💡 7. Quick Tips & Common Gotchas for Codex

1. **Arabic Text Direction:** When modifying UI components in `apps/web/`, ensure all layouts preserve RTL flow (`dir="rtl"`, Cairo font, appropriate flex directions).
2. **Offline Attendance Queue:** In `apps/web/src/app.js`, attendance check-ins are saved to `localStorage.centrly_attendance_offline_queue` if network drops, and synced via `/sessions/:id/offline-sync` upon reconnect.
3. **Normalized MRR Formula:** Starter (499 EGP), Growth (899 EGP), Scale (1399 EGP). The founder dashboard normalizes these numbers to show recurring revenue after first-month promotional discounts expire.
4. **Environment Variables:**
   * Backend requires: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `NODE_ENV`.
   * Frontend requires: `API_BASE_URL` (configured automatically via `apps/web/src/services/api.js`).

---
*Document Version: 1.0.0 — Authored for Codex Handover & Continuous Engineering.*
