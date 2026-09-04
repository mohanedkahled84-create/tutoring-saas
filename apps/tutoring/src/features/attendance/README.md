# Attendance Feature (`features/attendance`)

## Overview
Manages attendance check-ins, barcode scan duplicate-guards, batch attendance entry, offline-first sync engine, and WhatsApp delivery visibility per session.

## Architecture Compliance (Rules 1-8)
- **`types.ts`**: Pure TypeScript contracts (`IAttendanceRepository`, `ScanStudentInput`, `ScanStudentResult`, `OfflineBatchSyncResult`, `DeliveryStatusReport`).
- **`service.ts`**: Pure business logic with **zero Supabase dependencies**. Contains:
  - `evaluateNotificationDecision`: Pure classification determining if an attendance record warrants parent notification.
  - `scanStudent`: Enforces duplicate-scan protection (idempotent, never creates duplicate entries or duplicate messages).
  - `syncOfflineBatch`: Idempotent batch sync for offline scanner devices.
  - `getDeliveryStatus`: Correlates attendance records with message logs for delivery transparency.
- **`repository.ts`**: Direct Supabase database queries (`SupabaseAttendanceRepository`).
- **`routes.ts`**: Thin HTTP router resolving `AttendanceService` from the composition root (`getServices(req).attendance`).
- **`index.ts`**: Public barrel.

## Endpoints
- `POST /api/sessions/:id/scan`: Barcode/manual student scan with duplicate protection.
- `POST /api/sessions/:id/attendance`: Batch attendance entry.
- `POST /api/sessions/:id/attendance/batch-sync`: Offline-first batch sync.
- `GET /api/sessions/:id/delivery-status`: WhatsApp delivery report.
