-- Term Report publish workflow.
--
-- Until now, term-report totals were recomputed live every time someone opened
-- a card. That had three problems:
--   1. Slow (especially for Annual Reports that aggregate multiple terms).
--   2. No audit trail — a published report card could silently change later
--      if a teacher fixed a typo in a source PA mark.
--   3. Composition fragility — Annual Report had to re-derive Term-N math
--      bit-for-bit; any rounding/tiebreak drift = inconsistent numbers.
--
-- This migration adds:
--   - term_report_subject_totals: snapshot of per-(student, subject) totals
--     with both buckets (best PA halved, term sum) and the derived total/%/grade.
--   - exam_groups.published_at / published_by: when this term_report was last
--     published (NULL = never).
--   - publish_term_report() RPC: runs the live math once, writes snapshots,
--     marks the row published. Idempotent — replaces any existing snapshot
--     for that (term_report, student, subject).

------------------------------------------------------------------------------
-- 1. Columns on exam_groups
------------------------------------------------------------------------------
alter table public.exam_groups
  add column if not exists published_at timestamptz null,
  add column if not exists published_by uuid null;

comment on column public.exam_groups.published_at is
  'For kind=term_report: timestamp the report was last published (snapshot computed). Null = unpublished.';

------------------------------------------------------------------------------
-- 2. Snapshot table
------------------------------------------------------------------------------
create table if not exists public.term_report_subject_totals (
  term_report_id uuid not null references public.exam_groups(id) on delete cascade,
  student_id     uuid not null references public.student(id)     on delete cascade,
  subject_id     uuid not null references public.subjects(id)    on delete cascade,
  school_code    text not null,

  -- Raw best-PA + term buckets, BEFORE the per-subject halve. These let us
  -- regenerate either the mid-term card or the annual card without losing
  -- precision to rounding.
  best_pa_raw_marks  numeric not null default 0,
  best_pa_raw_max    numeric not null default 0,
  term_marks         numeric not null default 0,
  term_max           numeric not null default 0,

  -- Display values (best_pa halved + term as-is). These match what the Term
  -- Report card and pivot show. Annual reports halve THESE numbers.
  best_pa_halved_marks numeric not null default 0,
  best_pa_halved_max   numeric not null default 0,
  total_marks          numeric not null default 0,
  total_max            numeric not null default 0,
  percentage           numeric null,
  grade                text null,
  has_any_marks        boolean not null default false,

  published_at timestamptz not null default now(),
  primary key (term_report_id, student_id, subject_id)
);

create index if not exists trsub_school_idx
  on public.term_report_subject_totals (school_code);
create index if not exists trsub_term_idx
  on public.term_report_subject_totals (term_report_id);
create index if not exists trsub_student_idx
  on public.term_report_subject_totals (student_id);

------------------------------------------------------------------------------
-- 3. RLS
------------------------------------------------------------------------------
alter table public.term_report_subject_totals enable row level security;

drop policy if exists "trsub_select" on public.term_report_subject_totals;
create policy "trsub_select" on public.term_report_subject_totals
  for select using (school_code = current_school_code());

drop policy if exists "trsub_write" on public.term_report_subject_totals;
create policy "trsub_write" on public.term_report_subject_totals
  for all using (school_code = current_school_code())
         with check (school_code = current_school_code());

------------------------------------------------------------------------------
-- 4. publish_term_report RPC
------------------------------------------------------------------------------
-- Runs the existing live math (best PA per student per subject + term sums)
-- and writes one row per (student, subject) in the snapshot table.
--
-- Math (matches buildTermReportCardData):
--   best_pa_raw     = highest-percentage PA per (student, subject)
--   best_pa_halved  = best_pa_raw / 2  (max also halved)
--   term_marks      = sum of non-PA cells
--   total_marks     = best_pa_halved_marks + term_marks
--   percentage      = total_marks / total_max × 100
--   grade           = lookup from term_report.grading_scale_id

create or replace function public.publish_term_report(
  p_term_report_id uuid
)
returns int  -- number of (student, subject) snapshot rows written
language plpgsql
security invoker
as $$
declare
  v_school_code text;
  v_user uuid;
  v_scale_id uuid;
  v_scale jsonb;
  v_count int := 0;
begin
  -- Resolve term_report and validate
  select school_code, grading_scale_id, auth.uid()
    into v_school_code, v_scale_id, v_user
    from public.exam_groups
    where id = p_term_report_id and kind = 'term_report';
  if v_school_code is null then
    raise exception 'Term report not found or not a term_report: %', p_term_report_id;
  end if;

  -- Resolve grading scale (may be null → fall back to school default)
  if v_scale_id is not null then
    select scale into v_scale from public.grading_scales where id = v_scale_id;
  end if;
  if v_scale is null then
    select scale into v_scale
      from public.grading_scales
      where school_code = v_school_code and is_default = true
      limit 1;
  end if;

  -- Compute and upsert. We run a single CTE pipeline that mirrors the term
  -- report math exactly, then upsert the resulting (student, subject) rows.
  with picked_terms as (
    select source_group_ids from public.exam_groups where id = p_term_report_id
  ),
  -- All assessment exam_groups referenced by this term_report
  picked_assessments as (
    select eg.id as exam_group_id, coalesce(eg.is_pa, false) as is_pa
    from picked_terms pt
    cross join lateral unnest(coalesce(pt.source_group_ids, array[]::uuid[])) as src(id)
    join public.exam_groups eg on eg.id = src.id and eg.kind = 'assessment'
  ),
  -- Tests under those assessments, scoped to the classes covered by this term_report
  selected as (
    select
      pa.exam_group_id, pa.is_pa,
      t.id as test_id, t.subject_id, t.class_instance_id,
      coalesce(t.max_marks, 0)::numeric as max_marks
    from picked_assessments pa
    join public.exam_group_tests egt on egt.exam_group_id = pa.exam_group_id
    join public.tests t on t.id = egt.test_id
    join public.exam_group_classes egc
      on egc.exam_group_id = p_term_report_id
     and egc.class_instance_id = t.class_instance_id
  ),
  -- Students in classes covered by this term_report
  stu as (
    select s.id as student_id
    from public.exam_group_classes egc
    join public.student s on s.class_instance_id = egc.class_instance_id
    where egc.exam_group_id = p_term_report_id
  ),
  -- Aggregate to (student, exam_group, subject)
  scored as (
    select
      stu.student_id,
      sel.exam_group_id, sel.is_pa, sel.subject_id,
      coalesce(sum(tm.marks_obtained), 0)::numeric as marks_obtained,
      coalesce(sum(sel.max_marks), 0)::numeric    as max_marks,
      bool_or(tm.test_id is not null)              as has_any_marks
    from stu
    cross join selected sel
    left join public.test_marks tm
      on tm.test_id = sel.test_id and tm.student_id = stu.student_id
    group by 1,2,3,4
  ),
  -- Rank PAs by percentage per (student, subject)
  ranked_pa as (
    select sc.*,
      case when sc.is_pa then
        row_number() over (
          partition by sc.student_id, sc.subject_id
          order by
            case when sc.has_any_marks then 0 else 1 end,
            case
              when sc.has_any_marks and sc.max_marks > 0
                then sc.marks_obtained / sc.max_marks
              else -1
            end desc,
            sc.exam_group_id
        )
      else null end as pa_rank
    from scored sc
  ),
  -- Per (student, subject): collapse to best-PA + term sums
  per_subject as (
    select
      r.student_id, r.subject_id,
      sum(case when r.is_pa and r.pa_rank = 1 then r.marks_obtained else 0 end) as best_pa_raw_marks,
      sum(case when r.is_pa and r.pa_rank = 1 then r.max_marks      else 0 end) as best_pa_raw_max,
      sum(case when not r.is_pa then r.marks_obtained else 0 end) as term_marks,
      sum(case when not r.is_pa then r.max_marks      else 0 end) as term_max,
      bool_or(r.has_any_marks) as has_any_marks
    from ranked_pa r
    group by 1,2
  ),
  finalised as (
    select
      ps.*,
      ps.best_pa_raw_marks / 2.0 as best_pa_halved_marks,
      ps.best_pa_raw_max   / 2.0 as best_pa_halved_max,
      (ps.best_pa_raw_marks / 2.0) + ps.term_marks as total_marks,
      (ps.best_pa_raw_max   / 2.0) + ps.term_max   as total_max
    from per_subject ps
  ),
  upserted as (
    insert into public.term_report_subject_totals (
      term_report_id, student_id, subject_id, school_code,
      best_pa_raw_marks, best_pa_raw_max,
      term_marks, term_max,
      best_pa_halved_marks, best_pa_halved_max,
      total_marks, total_max,
      percentage,
      grade,
      has_any_marks,
      published_at
    )
    select
      p_term_report_id, f.student_id, f.subject_id, v_school_code,
      f.best_pa_raw_marks, f.best_pa_raw_max,
      f.term_marks, f.term_max,
      f.best_pa_halved_marks, f.best_pa_halved_max,
      f.total_marks, f.total_max,
      case when f.total_max > 0 and f.has_any_marks
           then round((f.total_marks / f.total_max * 100)::numeric, 2)
           else null end as percentage,
      -- Grade lookup from the JSONB scale (each band: {min, max, grade})
      (
        select b->>'grade'
        from jsonb_array_elements(coalesce(v_scale, '[]'::jsonb)) b
        where f.total_max > 0 and f.has_any_marks
          and (f.total_marks / f.total_max * 100) >= (b->>'min')::numeric
          and (f.total_marks / f.total_max * 100) <= (b->>'max')::numeric
        limit 1
      ) as grade,
      f.has_any_marks,
      now()
    from finalised f
    on conflict (term_report_id, student_id, subject_id) do update set
      best_pa_raw_marks    = excluded.best_pa_raw_marks,
      best_pa_raw_max      = excluded.best_pa_raw_max,
      term_marks           = excluded.term_marks,
      term_max             = excluded.term_max,
      best_pa_halved_marks = excluded.best_pa_halved_marks,
      best_pa_halved_max   = excluded.best_pa_halved_max,
      total_marks          = excluded.total_marks,
      total_max            = excluded.total_max,
      percentage           = excluded.percentage,
      grade                = excluded.grade,
      has_any_marks        = excluded.has_any_marks,
      published_at         = excluded.published_at
    returning 1
  )
  select count(*) into v_count from upserted;

  -- Mark the term_report itself as published
  update public.exam_groups
    set published_at = now(),
        published_by = v_user
    where id = p_term_report_id;

  return v_count;
end;
$$;

grant execute on function public.publish_term_report(uuid) to authenticated;
comment on function public.publish_term_report(uuid) is
  'Snapshot a Term Report''s per-(student, subject) totals into term_report_subject_totals. Idempotent — safe to call multiple times to refresh after source mark edits.';

------------------------------------------------------------------------------
-- 5. generate_annual_report (rewritten to read snapshots)
------------------------------------------------------------------------------
-- Now reads from term_report_subject_totals — guaranteed consistent with each
-- term report's published card. Halves the saved totals for the annual.

create or replace function public.generate_annual_report(
  p_term_report_ids uuid[],
  p_class_instance_id uuid,
  p_student_id uuid default null
)
returns table (
  student_id uuid,
  student_name text,
  student_code text,
  subject_id uuid,
  subject_name text,
  term_report_id uuid,
  term_report_name text,
  term_report_sequence int,
  halved_marks numeric,
  halved_max numeric,
  has_any_marks boolean,
  source_published_at timestamptz
)
language sql
stable security invoker
as $$
  with picked_terms as (
    select tr.id, tr.name, tr.published_at, tr_idx.ord::int as sequence
    from unnest(coalesce(p_term_report_ids, array[]::uuid[]))
         with ordinality as tr_idx(id, ord)
    join public.exam_groups tr
      on tr.id = tr_idx.id and tr.kind = 'term_report'
  ),
  stu as (
    select s.id, s.full_name, s.student_code
    from public.student s
    where s.class_instance_id = p_class_instance_id
      and (p_student_id is null or s.id = p_student_id)
  ),
  -- Cross-join students × terms × snapshot rows so missing rows surface as null
  joined as (
    select
      stu.id   as student_id,
      stu.full_name as student_name,
      stu.student_code as student_code,
      pt.id    as term_report_id,
      pt.name  as term_report_name,
      pt.sequence as term_report_sequence,
      pt.published_at as source_published_at,
      snap.subject_id,
      snap.total_marks,
      snap.total_max,
      snap.has_any_marks
    from stu
    cross join picked_terms pt
    left join public.term_report_subject_totals snap
      on snap.term_report_id = pt.id
     and snap.student_id = stu.id
  )
  select
    j.student_id, j.student_name, j.student_code,
    j.subject_id,
    sub.subject_name,
    j.term_report_id, j.term_report_name, j.term_report_sequence,
    -- Halve the saved per-subject total for the annual
    round((coalesce(j.total_marks, 0) / 2.0)::numeric, 2) as halved_marks,
    round((coalesce(j.total_max,   0) / 2.0)::numeric, 2) as halved_max,
    coalesce(j.has_any_marks, false) as has_any_marks,
    j.source_published_at
  from joined j
  left join public.subjects sub on sub.id = j.subject_id
  -- Drop rows where the term has no snapshot at all (subject_id is null)
  where j.subject_id is not null
  order by j.student_name, sub.subject_name, j.term_report_sequence;
$$;

grant execute on function public.generate_annual_report(uuid[], uuid, uuid) to authenticated;
