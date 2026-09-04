# Centrly — Arabic-First Tutoring & Center Management SaaS

**Centrly** is a production-grade, multi-tenant SaaS platform engineered specifically for private tutors and educational centers in Egypt. It streamlines student attendance, automated WhatsApp communication with parents, quiz grade tracking, make-up sessions, automated risk watchlists, and subscription billing.

---

## Architecture Overview

Centrly is built as a modular monorepo following strict **Clean Architecture** and **Feature-Sliced Design** principles:

```
Ai business/
├── apps/
│   ├── tutoring/             # Express/TypeScript backend API
│   │   ├── src/
│   │   │   ├── features/     # Self-contained domain features (Clean Architecture)
│   │   │   │   ├── activity-log/
│   │   │   │   ├── admin-ops/
│   │   │   │   ├── attendance/
│   │   │   │   ├── auth/
│   │   │   │   ├── billing/
│   │   │   │   ├── groups/
│   │   │   │   ├── risk-watchlist/
│   │   │   │   ├── sessions/
│   │   │   │   ├── students/
│   │   │   │   └── whatsapp-notifications/
│   │   │   ├── shared/       # Cross-cutting framework infra (middleware, config, utils)
│   │   │   ├── app.ts        # Express app configuration & route mounting
│   │   │   ├── composition.ts# Composition Root (Dependency Injection wiring)
│   │   │   ├── server.ts     # HTTP server entrypoint
│   │   │   └── supabase.ts   # Supabase client factory
│   │   └── tests/            # Fast, 100% in-memory unit tests using Fake repositories
│   └── web/                  # Next.js 14 Web Application (Arabic-First / RTL)
├── packages/                 # Shared domain packages and contracts
└── supabase/
    └── migrations/           # Multi-tenant PostgreSQL migrations & RLS policies
```

---

## Core Coding & Clean Architecture Standards

Every developer and AI agent working on this codebase must adhere strictly to these principles:

1. **Rule 1 — Zero DB/Supabase Imports in Domain Services**:
   - `features/<name>/service.ts` contains **pure business rules**.
   - It **NEVER** imports `@supabase/supabase-js`, `supabase.ts`, or executes SQL.
   - All data operations are accessed through `I<Feature>Repository` interface defined in `features/<name>/types.ts`.
2. **Rule 2 — Encapsulated Repositories**:
   - `features/<name>/repository.ts` contains `Supabase<Feature>Repository` (the database adapter) and `Fake<Feature>Repository` (for in-memory unit testing).
3. **Rule 3 — Composition Root**:
   - `apps/tutoring/src/composition.ts` is the single place where Supabase-backed repositories are instantiated and injected into domain services.
4. **Rule 4 — Public Surface & Barrel Exports**:
   - Modules communicate across feature boundaries strictly through the barrel `features/<name>/index.ts`. No internal deep imports.
5. **Rule 5 — Arabic-First & RTL UI**:
   - All client-facing interfaces are set with `dir="rtl"` using Cairo font and genuine Egyptian Arabic terminology.

---

## Feature Folder Structure

Every domain feature inside `apps/tutoring/src/features/<feature-name>/` follows this exact standard layout:

| File | Purpose | Rule |
| :--- | :--- | :--- |
| `types.ts` | Domain entity types, DTOs, and `I<Feature>Repository` interface | No runtime external dependencies |
| `service.ts` | Pure business logic (`<Feature>Service`) | Zero DB imports; constructor takes `IRepository` |
| `repository.ts` | `Supabase<Feature>Repository` + `Fake<Feature>Repository` | Direct database queries live here only |
| `routes.ts` | Express router delegating request handling to service | Uses `getServices(req).<feature>` |
| `index.ts` | Barrel export for external consumption | Re-exports public types, service, repository, and routes |
| `README.md` | Feature quick-reference documentation | Explains purpose, public API, and edge cases |

---

## How to Add a New Feature

When introducing a new domain capability:

1. **Create the Feature Folder**:
   ```bash
   mkdir -p apps/tutoring/src/features/<new-feature>
   ```
2. **Define Contracts (`types.ts`)**:
   - Define domain models, input DTOs, and `I<NewFeature>Repository`.
3. **Implement Domain Logic (`service.ts`)**:
   - Write `<NewFeature>Service` taking `I<NewFeature>Repository` via constructor.
   - Strictly prohibit `@supabase/supabase-js` imports.
4. **Implement Repositories (`repository.ts`)**:
   - Write `Supabase<NewFeature>Repository` using the Supabase client.
   - Write `Fake<NewFeature>Repository` using in-memory arrays for testing.
5. **Implement Router (`routes.ts`)**:
   - Create Express routes that retrieve `<NewFeature>Service` from request context via `getServices(req)`.
6. **Export Public Interface (`index.ts`)**:
   - Export all types, repository classes, service class, and router.
7. **Wire into Composition Root**:
   - Register service in `apps/tutoring/src/composition.ts` and mount router in `apps/tutoring/src/app.ts`.
8. **Add Unit Tests**:
   - Create `apps/tutoring/tests/<new-feature>.test.mjs` running against `Fake<NewFeature>Repository`.

---

## Local Development & Setup

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- Active Supabase project (URL + Anon Key + Service Role Key)

### 1. Environment Setup
Copy the environment template in `apps/tutoring/`:
```bash
cp apps/tutoring/.env.example apps/tutoring/.env
```
Ensure the following variables are configured:
```env
PORT=3001
NODE_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
INTERNAL_API_SECRET=your-internal-secret
```

### 2. Install Dependencies
```bash
# Root & backend
cd apps/tutoring
npm install

# Frontend
cd ../web
npm install
```

### 3. Run Backend Development Server
```bash
cd apps/tutoring
npm run dev
```
The API server will launch at `http://localhost:3001`.
Health check: `http://localhost:3001/health`

### 4. Run Frontend Development Server
```bash
cd apps/web
npm run dev
```
The Next.js web application will launch at `http://localhost:3000`.

---

## Testing & Quality Assurance

All features maintain comprehensive unit test coverage with fast in-memory test doubles:

```bash
cd apps/tutoring

# Run full test suite
npm test

# Type checking & compilation
npm run build

# Code linting
npm run lint

# Code formatting check
npm run format:check
```

---

## Database Migrations

Database migrations are tracked under `supabase/migrations/`:
- Multi-tenant Row Level Security (RLS) enabled on all tables.
- Helper RPC stored procedures for high-security vault decryption.
- Auto-incrementing student code triggers and indexing.
