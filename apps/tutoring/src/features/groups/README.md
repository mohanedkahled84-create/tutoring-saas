# Groups Feature (`features/groups`)

## Overview
The `groups` feature manages class groups, pricing/billing models (percentage split vs fixed rent), student group enrollments, and printable group barcode sheets.

## Architectural Boundaries (Clean Architecture)
- **`types.ts`**: Pure domain types (`Group`, `CreateGroupDTO`, `UpdateGroupDTO`, `EnrolledStudent`) and `IGroupsRepository` contract.
- **`service.ts`**: Pure domain business logic (`GroupsService`). Implements role-based field sanitization for assistants (hiding prices and billing details), student enrollment workflows, and barcode student compilation. ZERO database imports.
- **`repository.ts`**: Data access implementations (`SupabaseGroupsRepository` and in-memory double `FakeGroupsRepository`).
- **`routes.ts`**: Express route handlers (`groupsRouter`) wired to the composition root.
- **`index.ts`**: Barrel export for module consumers.
