# Sessions Feature (`features/sessions`)

## Overview
Handles session lifecycle (CRUD), quiz scores tracking, session financial summary computation, and WhatsApp settlement receipt generation for teachers and centers.

## Architecture Compliance (Rules 1-8)
- **`types.ts`**: Pure TypeScript contracts (`ISessionsRepository`, `SessionModel`, `FinancialSummaryResult`, `ReceiptResult`, `QuizScoreRecord`).
- **`service.ts`**: Pure domain logic and calculations. Contains **zero imports** from `@supabase/supabase-js`.
  - `calculateFinancialSummary`: Computes base revenue, student exemptions, fee overrides, and make-up attendee retention.
  - `generateReceipt`: Calculates teacher vs center billing splits (`fixed_rent` vs `percentage`) and formats Egyptian Arabic settlement text.
- **`repository.ts`**: Implements `SupabaseSessionsRepository` (the only file with Supabase queries for this feature).
- **`routes.ts`**: Thin HTTP router resolving `SessionsService` from the composition root (`getServices(req).sessions`).
- **`index.ts`**: Public barrel.

## Endpoints
- `POST /api/sessions/`: Create a new session.
- `GET /api/sessions/:id`: Retrieve session with attendance and quiz scores.
- `PUT /api/sessions/:id/quiz-scores/:student_id`: Incremental quiz score auto-save.
- `GET /api/sessions/:id/quiz-scores`: List quiz scores.
- `GET /api/sessions/:id/financial-summary`: Compute financial breakdown (restricted from assistants).
- `POST /api/sessions/:id/receipt`: Generate settlement receipt and optionally queue to WhatsApp.
