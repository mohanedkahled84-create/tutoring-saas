-- 20260905000002_dev_tenant_workflow_settings.sql
-- DEV-38: Tenant-Configurable Workflow Settings

alter table public.tenants 
  add column if not exists settings jsonb not null 
  default '{"homework_submission": "in_session", "auto_notification": true, "enable_top_performers": true}'::jsonb;
