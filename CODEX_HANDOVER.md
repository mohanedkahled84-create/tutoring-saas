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

---

## 📡 5. Complete API Catalog

Base URL (Production): `https://tutoring-backend-production-c8dd.up.railway.app/api`  
Base URL (Local): `http://localhost:3000/api`

### 1. Authentication & Session (`/api/auth`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Teacher / Center owner registration with tenant creation |
| `POST` | `/api/auth/login` | Public | Email/Password login, returns JWT token & user profile |
| `POST` | `/api/auth/logout` | Yes | Invalidates session and clears cookies |
| `POST` | `/api/auth/refresh` | Public | Silent token refresh using refresh token |
| `GET` | `/api/auth/me` | Yes | Returns current authenticated user and tenant context |
| `PUT` | `/api/auth/profile` | Yes | Updates name, phone, subject, or preferences |
| `POST` | `/api/auth/change-password` | Yes | Changes user account password |
| `POST` | `/api/auth/verify-pin` | Yes | Validates financial security PIN |
| `POST` | `/api/auth/set-pin` | Yes | Sets or resets financial security PIN |

### 2. Superadmin / Centrly HQ (`/api/admin` — Role `admin` only)
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

### 3. Billing & Subscriptions (`/api/billing`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/billing/status` | Yes | Current tenant subscription status, limits, days remaining |
| `POST` | `/api/billing/payment-proof` | Yes | Submits bank/Instapay transfer screenshot and reference |
| `POST` | `/api/billing/coupons/validate`| Yes | Validates coupon codes (e.g., `CEN100` for 100% off) |

### 4. Students Directory (`/api/students`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/students` | Yes | List students (supports `search`, `group_id`, `status` filters) |
| `POST` | `/api/students` | Yes | Add new student (auto-generates 6-digit portal password) |
| `GET` | `/api/students/:id` | Yes | Student details, attendance history, balance, portal code |
| `PUT` | `/api/students/:id` | Yes | Update student profile, parent phone, or notes |
| `DELETE` | `/api/students/:id` | Yes | Soft-delete student |
| `POST` | `/api/groups/import` | Yes | Bulk CSV/Excel student roster import |
| `GET` | `/api/students/barcode-sheet` | Yes | Generates ready-to-print A4 PDF barcode sheet |

### 5. Groups & Batch Schedules (`/api/groups`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/groups` | Yes | List all academic groups with student count and schedules |
| `POST` | `/api/groups` | Yes | Create group (grade level, subject, session pricing, hall) |
| `GET` | `/api/groups/:id` | Yes | Group details, roster, and scheduled sessions |
| `PUT` | `/api/groups/:id` | Yes | Update group schedule or pricing |
| `DELETE` | `/api/groups/:id` | Yes | Delete or archive group |

### 6. Classroom Sessions & Live Attendance (`/api/sessions`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sessions` | Yes | List sessions by date range, group, or status |
| `POST` | `/api/sessions` | Yes | Start a new live classroom session (`in_progress`) |
| `GET` | `/api/sessions/:id` | Yes | Session details, live attendance roster, revenue split |
| `POST` | `/api/sessions/:id/scan` | Yes | Instant barcode/QR check-in for a student |
| `POST` | `/api/sessions/:id/attendance`| Yes | Manual attendance toggle (present / absent / exempt) |
| `POST` | `/api/sessions/:id/offline-sync`| Yes | Flushes queued offline attendance scans |
| `POST` | `/api/sessions/:id/end` | Yes | Finalizes session, calculates financials, dispatches alerts |

### 7. Homework & Quizzes (`/api/homework`, `/api/quizzes`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/homework` | Yes | List published homework assignments |
| `POST` | `/api/homework` | Yes | Publish new homework with deadline & questions |
| `GET` | `/api/homework/:id/submissions` | Yes | List student submissions with uploaded photos |
| `POST` | `/api/homework/:id/grade` | Yes | Grade student homework submission |
| `GET` | `/api/quizzes` | Yes | List quizzes and scores |
| `POST` | `/api/quizzes` | Yes | Record quiz score and trigger WhatsApp parent alert |

### 8. WhatsApp & Messaging (`/api/whatsapp`, `/api/templates`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/whatsapp/status` | Yes | QR connection status, battery, warm-up pacing tier |
| `GET` | `/api/whatsapp/qr` | Yes | Generates QR code to link teacher's WhatsApp device |
| `POST` | `/api/whatsapp/disconnect` | Yes | Unlinks WhatsApp device |
| `GET` | `/api/templates` | Yes | List spintax message templates |
| `PUT` | `/api/templates/:id` | Yes | Customize notification wording |
| `POST` | `/api/whatsapp/broadcast` | Yes | Send custom announcement with anti-ban pacing |

### 9. Public & Student Portal (`/api/public`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/public/portal/login` | Public | Student/Parent login using Phone + 6-digit PIN |
| `GET` | `/api/public/portal/me` | Portal Token | Student dashboard, attendance history, homework grades |
| `POST` | `/api/public/homework/upload` | Portal Token | Student uploads homework photos |
| `GET` | `/api/public/register/:code` | Public | Student self-registration form via teacher link |

### 10. Health & Diagnostics (`/health`)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health/ping` | None | Instant uptime check (Railway deployment healthcheck) |
| `GET` | `/health` | None | Detailed database, memory, and services health |

---

## ⚙️ 6. Development, Testing, and Deployment Workflow

### 1. Running Backend Tests
The backend has **341 automated unit and integration tests** verifying all business rules, security boundaries, rate limits, and billing calculations:
```bash
cd apps/tutoring
npm test
```
> ⚠️ **Codex Requirement:** Every new backend feature or bugfix must pass all 341 tests (`pass 341, fail 0`). Never commit code that breaks existing tests.

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

### 4. Git Deployment (Vercel + Railway)
Pushing to the `main` branch of GitHub automatically triggers:
1. **Railway:** Builds and deploys the backend API via Nixpacks (`railway.json`).
2. **Vercel:** Deploys the web client instantly.

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
