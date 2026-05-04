-- Term Reports
--
-- A Term Report is a special exam_groups row that doesn't hold marks of its
-- own. Instead, it references a list of source exam_groups (PAs, term exams,
-- etc.) and renders a consolidated view via generate_clubbed_report.
--
-- Modeled as a `kind` column on exam_groups so it lives in the same list and
-- can be published to the existing report_cards table per student.
--
-- Backward-compatible: every existing row defaults to kind='assessment'.

------------------------------------------------------------------------------
-- 1. Schema additions
------------------------------------------------------------------------------
alter table public.exam_groups
  add column if not exists kind text not null default 'assessment'
    check (kind in ('assessment','term_report')),
  add column if not exists source_group_ids uuid[] null,
  add column if not exists pa_best_of int not null default 2;

comment on column public.exam_groups.kind is
  'assessment = a real exam students sit for. term_report = a derived report that consolidates other assessments via generate_clubbed_report.';

comment on column public.exam_groups.source_group_ids is
  'For kind=term_report only: array of exam_group ids whose marks are clubbed into this report.';

comment on column public.exam_groups.pa_best_of is
  'For kind=term_report only: number of PA scores to keep per (student, subject). 0 = no best-of, include all.';

create index if not exists exam_groups_kind_idx
  on public.exam_groups (school_code, kind);

------------------------------------------------------------------------------
-- 2. Integrity rules
------------------------------------------------------------------------------
-- A term_report must have at least one source. Use a CHECK so the backend
-- can never accidentally save an empty term_report.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'exam_groups_term_report_sources_chk'
  ) then
    alter table public.exam_groups
      add constraint exam_groups_term_report_sources_chk
      check (
        kind = 'assessment'
        or (kind = 'term_report' and source_group_ids is not null
            and array_length(source_group_ids, 1) >= 1)
      );
  end if;
end$$;

------------------------------------------------------------------------------
-- 3. Helper: resolve all classes a term_report covers (union of source classes)
------------------------------------------------------------------------------
-- Used by the UI's class picker on the term report detail view.
create or replace function public.term_report_classes(p_term_report_id uuid)
returns table (class_instance_id uuid)
language sql stable security invoker as $$
  with src as (
    select unnest(source_group_ids) as src_id
    from public.exam_groups
    where id = p_term_report_id and kind = 'term_report'
  )
  select distinct egc.class_instance_id
  from src
  join public.exam_group_classes egc on egc.exam_group_id = src.src_id;
$$;

grant execute on function public.term_report_classes(uuid) to authenticated;

comment on function public.term_report_classes(uuid) is
  'Returns the union of classes covered by a term_report''s source assessments.';
