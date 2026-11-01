-- Existing assistants keep their salary model, rate and history unchanged.
alter table public.assistants
  add column if not exists work_weekdays integer[] not null default '{}',
  add column if not exists pay_start_date date;

alter table public.assistants
  add constraint assistants_work_weekdays_valid check (
    work_weekdays <@ array[0,1,2,3,4,5,6]::integer[]
    and cardinality(work_weekdays) <= 7
    and array_position(work_weekdays, null) is null
  ),
  add constraint assistants_daily_pay_schedule_required check (
    salary_model is distinct from 'per_day'
    or (pay_start_date is not null and cardinality(work_weekdays) > 0)
  );

comment on column public.assistants.work_weekdays is
  'Automatic daily pay calendar. Sunday=0 through Saturday=6; does not represent assistant attendance.';
comment on column public.assistants.pay_start_date is
  'First eligible work date; null preserves existing monthly/per-session records.';
