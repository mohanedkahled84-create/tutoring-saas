# Auth Feature (`features/auth`)

## Overview
The `auth` feature encapsulates user authentication, tenant registration with 14-day trials, brute-force lockout safeguards, and secure password recovery.

## Architectural Boundaries (Clean Architecture)
- **`types.ts`**: Authentication models (`LoginDTO`, `LoginResult`, `SignupDTO`, `SignupResult`, `ResetPasswordDTO`) and `IAuthRepository` contract.
- **`service.ts`**: Pure domain logic (`AuthService`). Handles credential evaluation, brute-force locking window, password policy enforcement, and asynchronous founder alert dispatching. ZERO database imports.
- **`repository.ts`**: Supabase Auth client integration (`SupabaseAuthRepository`) and in-memory test implementation (`FakeAuthRepository`).
- **`routes.ts`**: Express route handlers (`authRouter`) delegating request handling to `AuthService`.
- **`index.ts`**: Public barrel export.
