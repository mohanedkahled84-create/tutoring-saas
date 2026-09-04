# Risk-Watchlist Feature (`features/risk-watchlist`)

## Overview
Computes the academic and attendance "At-Risk" student watchlist and manages tailored alerts sent to parents.

## Architecture Compliance (Rules 1-8)
- **`types.ts`**: Pure TypeScript interfaces and contracts (`IRiskWatchlistRepository`, `AtRiskStudent`, `RiskCategory`, `AlertType`).
- **`service.ts`**: Pure domain logic and calculations. Contains **zero imports** from `@supabase/supabase-js`. All storage access is injected via `IRiskWatchlistRepository`.
- **`repository.ts`**: Encapsulates all Supabase database queries and persistence details (`SupabaseRiskWatchlistRepository`).
- **`routes.ts`**: Thin HTTP presentation layer. Resolves `RiskWatchlistService` from the composition root (`getServices(req).riskWatchlist`), performs Zod request validation, and responds with standard JSON.
- **`index.ts`**: Public barrel module for cross-feature encapsulation.

## Key Business Rules
1. **Absence Warning**: Triggered when a student has $\ge 2$ consecutive unexcused absences in recent sessions.
2. **Grade Drop**: Triggered when a student's quiz average falls below $50\%$ across their last 3 quizzes ($< 30\%$ escalates severity to `high`).
3. **Homework Neglect**: Triggered when $\ge 2$ consecutive homework submissions are recorded as `missing`.
4. **Severity & Ordering**: Students with high severity are sorted first, followed by alphabetical order by name.
5. **Idempotency**: Parent alert records use unique daily keys (`tenant:student_id:alert:alert_type:YYYY-MM-DD`) preventing duplicate message spam.
