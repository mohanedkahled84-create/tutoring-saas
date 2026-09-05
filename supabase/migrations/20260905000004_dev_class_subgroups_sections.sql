-- 20260905000004_dev_class_subgroups_sections.sql
-- DEV-49: Class Sub-Groups (Sections) per Teacher

-- 1. Extend groups table with self-referencing hierarchy for sections
alter table public.groups add column if not exists parent_group_id uuid references public.groups(id) on delete cascade;
alter table public.groups add column if not exists is_section boolean not null default false;
alter table public.groups add column if not exists section_name text;

create index if not exists idx_groups_parent_group on public.groups(parent_group_id);
create index if not exists idx_groups_tenant_sections on public.groups(tenant_id, is_section);
