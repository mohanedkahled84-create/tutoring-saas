# Platform Builder Feature (White-Label LMS Engine)

## Overview
Allows teachers to configure, brand, and launch their personal educational platform with a custom subdomain (e.g., `omarjamal.centrly.com`), custom primary color presets, and transparent cutout avatars.

## Architecture
- `types.ts`: Domain models and `IPlatformBuilderRepository` interface.
- `service.ts`: Pure business logic (`PlatformBuilderService`), subdomain regex/reserved checks, and PRO plan tier gating.
- `repository.ts`: Supabase and in-memory Fake repositories.
- `routes.ts`:
  - Public routes: `/api/platform/public/:subdomain` and `/api/platform/check/:subdomain`.
  - Protected routes: `/api/platform/settings` (GET & POST).
- `index.ts`: Public barrel exports.

## Business Rules
1. Subdomains must be 3-30 lowercase alphanumeric characters and hyphens, not matching reserved system keywords.
2. Activation and publishing of the personal platform is strictly locked behind the PRO plan tier.
