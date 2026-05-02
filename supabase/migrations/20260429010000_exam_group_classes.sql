-- Junction table: exam groups can span multiple classes.
-- One exam_group ↔ many class_instances. Replaces sole reliance on
-- exam_groups.class_instance_id (kept as a legacy "primary class" field).
--
-- A subject added to a multi-class exam_group materialises one tests row
-- per bound class, all linked to the same exam_group via exam_group_tests.

create table if not exists public.exam_group_classes (
  id uuid primary key default gen_random_uuid(),
  exam_group_id uuid not null references public.exam_groups(id) on delete cascade,
  class_instance_id uuid not null references public.class_instances(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (exam_group_id, class_instance_id)
);

create index if not exists exam_group_classes_group_idx
  on public.exam_group_classes (exam_group_id);

create index if not exists exam_group_classes_class_idx
  on public.exam_group_classes (class_instance_id);

-- Backfill from existing exam_groups.class_instance_id
insert into public.exam_group_classes (exam_group_id, class_instance_id)
select id, class_instance_id
from public.exam_groups
where class_instance_id is not null
on conflict (exam_group_id, class_instance_id) do nothing;

-- RLS via parent exam_group's school scope
alter table public.exam_group_classes enable row level security;

drop policy if exists "exam_group_classes_select" on public.exam_group_classes;
create policy "exam_group_classes_select" on public.exam_group_classes
  for select using (
    exists (
      select 1 from public.exam_groups eg
      where eg.id = exam_group_classes.exam_group_id
      and eg.school_code = current_school_code()
    )
  );

drop policy if exists "exam_group_classes_insert" on public.exam_group_classes;
create policy "exam_group_classes_insert" on public.exam_group_classes
  for insert with check (
    exists (
      select 1 from public.exam_groups eg
      where eg.id = exam_group_classes.exam_group_id
      and eg.school_code = current_school_code()
    )
  );

drop policy if exists "exam_group_classes_delete" on public.exam_group_classes;
create policy "exam_group_classes_delete" on public.exam_group_classes
  for delete using (
    exists (
      select 1 from public.exam_groups eg
      where eg.id = exam_group_classes.exam_group_id
      and eg.school_code = current_school_code()
    )
  );
