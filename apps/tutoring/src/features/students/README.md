# Students Feature (`features/students`)

## Overview
The `students` feature manages the complete lifecycle of students within a tenant, including student profile CRUD, auto-incrementing serial code tracking, public self-registration, bulk roster import (with Arabic/English header detection and phone normalization), and printable A4 barcode sheet generation.

## Architectural Boundaries (Clean Architecture)
This feature adheres strictly to the Centrly Clean Architecture principles:
- **`types.ts`**: Pure domain models (`Student`, `CreateStudentDTO`, `UpdateStudentDTO`, `ImportResult`, `BarcodeSheetOptions`) and `IStudentsRepository` contract.
- **`import.ts`**: Standalone sub-concern handling CSV string parsing, row mapping with multi-language aliases, and strict Egyptian phone normalization (`010`, `011`, `012`, `015`).
- **`barcodePdf.ts`**: Standalone sub-concern generating print-ready 24-card A4 PDF sheets with vector Code 39 barcodes.
- **`service.ts`**: Pure domain business logic (`StudentsService`). Contains **zero** database engine dependencies and operates purely through `IStudentsRepository`.
- **`repository.ts`**: Data access layer providing `SupabaseStudentsRepository` (Postgres/Supabase) and `FakeStudentsRepository` (in-memory test double).
- **`routes.ts`**: Express route handlers (`studentsRouter`, `importRouter`) delegating all request processing to `StudentsService` via composition root.
- **`index.ts`**: Public API barrel export for external modules.

## Key Capabilities

### 1. Bulk Student Import
- Supports direct JSON row array or raw CSV text payload.
- Automatically normalizes Egyptian phone numbers (handles `+20`, `0020`, `20`, leading `0`).
- Multi-dialect column aliasing supports Arabic and English headers (e.g. `اسم الطالب`, `موبايل ولي الأمر`, `كود`).
- Row-level error isolation: valid rows are imported while malformed rows report detailed errors with line numbers without aborting the batch.
- Auto-assigns consecutive serial numbers starting from 1001 or continues from the tenant's current maximum numeric code.

### 2. Barcode Sheet Generation
- Vector Code 39 barcode rendering.
- 3 columns × 8 rows (24 cards per A4 page).
- Dashed cutting guides, group name, student name, and human-readable code.

### 3. Public Self-Registration
- Allows unauthenticated students to self-enroll into target classes via shareable registration links.
