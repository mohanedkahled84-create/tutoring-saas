# Tutoring SaaS (Teaching System)

Multi-tenant SaaS for private tutors and tutoring centers in Egypt — attendance tracking and automated WhatsApp parent notifications.

## Architecture

- **Backend**: Node.js / TypeScript
- **Frontend**: Next.js (Arabic/RTL first)
- **Database & Auth**: Supabase (Postgres + Auth + RLS) — Project `Teaching system` (`ofaraxqrpcdiregxjyyb`)
- **Messaging**: Evolution API + n8n automation engine
- **Monorepo Structure**:
  - `packages/`: Shared packages (auth, WhatsApp contract, billing)
  - `apps/tutoring`: Tutoring system web application
  - `supabase/migrations`: Database schema migrations

## Database Migrations

Multi-tenant from day one: all tenant-scoped tables carry `tenant_id NOT NULL` referencing `public.tenants(id)` on delete cascade.

- `20260902000001_dev_csd_1_core_entities.sql`: `tenants`, `users`, `students`, `groups`, `group_students`
- `20260902000002_dev_csd_2_sessions_attendance.sql`: `sessions`, `attendance`
- `20260902000003_dev_csd_3_message_logs.sql`: `message_logs`
- `20260902000004_dev_csd_4_whatsapp_connections.sql`: `whatsapp_connections` (with secrets encrypted in Supabase Vault)
