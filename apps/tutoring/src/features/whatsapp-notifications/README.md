# WhatsApp Notifications Feature (`features/whatsapp-notifications`)

## Overview
Encapsulates all WhatsApp communication infrastructure, including Evolution API gateway communication, message template variant management, anti-ban protection safeguards (jitter, warmup scheduler, circuit breaker, business profile validator), and asynchronous n8n webhook dispatches.

## Architecture Compliance (Rules 1-8)
- **`types.ts`**: Pure TypeScript contracts (`IWhatsAppNotificationsRepository`, `JitterConfig`, `WarmUpCheckResult`, `HealthStateResult`, `ProfileChecklistResult`, `AttendanceWebhookPayload`, `MessageTemplate`).
- **`service.ts`**: Pure domain logic and protection engines with **zero Supabase dependencies**:
  - `calculateJitterDelay`: Randomized timing ($4000\text{ms} - 9000\text{ms}$) preventing automated detection.
  - `checkWarmUpLimit`: 6-day graduated warmup ramp ($20 \to 600$ messages/day) protecting new SIM cards.
  - `recordHealthError` / `getHealthStatus`: Circuit breaker pausing delivery on repeated errors/disconnects.
  - `validateBusinessProfile`: Pre-send profile completeness verification.
  - `dispatchAttendanceWebhook`: Deduplicated asynchronous dispatch to n8n webhook.
- **`repository.ts`**: Implements `SupabaseWhatsAppNotificationsRepository` for message logs deduplication checks and template persistence.
- **`routes.ts`**: Thin HTTP router exposing `/api/whatsapp` and `/api/templates`.
- **`index.ts`**: Public barrel module. Callers from `attendance` interact through `dispatchAttendanceWebhook`.
