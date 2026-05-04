-- Clubbed Term Reports
--
-- Lets the gradebook combine multiple exam_groups into one report and
-- automatically pick best-of-N for groups marked as Periodic Assessments (PA).
--
-- Design notes:
--   * One additive column (`exam_groups.is_pa`) — defaults to false so all
--     existing rows behave exactly as before.
--   * One new RPC (`generate_clubbed_report`) that does the per-student,
--     per-subject ranking inside SQL so best-of is computed safely server-side.
--   * `security invoker` so existing RLS on exam_groups / tests / test_marks /
--     student / subjects continues to apply. The RPC cannot leak across schools.
--   * Returns BOTH dropped and kept PA rows (with `included` flag) so the UI
--     can transparently show which PAs were used and which were filtered out.

------------------------------------------------------------------------------
-- 1. Schema: is_pa flag on exam_groups
------------------------------------------------------------------------------
alter table public.exam_groups
  add column if not exists is_pa boolean not null default false;

comment on column public.exam_groups.is_pa is
  'When true, this exam group is a Periodic Assessment. Clubbed reports apply best-of-N selection across all is_pa groups in the picked set.';

create index if not exists exam_groups_is_pa_idx
  on public.exam_groups (school_code, is_pa)
  where is_pa = true;

------------------------------------------------------------------------------
-- 2. RPC: generate_clubbed_report
------------------------------------------------------------------------------
-- Inputs:
--   p_exam_group_ids  : array of exam_groups the user ticked
--   p_class_instance_id : the class to compute for
--   p_student_id      : optional — null returns rows for the whole class
--   p_pa_best_of      : how many PA scores to keep per (student, subject).
--                       0 disables best-of (all PAs included).
--
-- Output rows: one row per (student, subject, exam_group). PA rows that lose
-- the best-of ranking are returned with included=false and drop_reason set so
-- the UI can grey them out instead of hiding them.

create or replace function public.generate_clubbed_report(
  p_exam_group_ids uuid[],
  p_class_instance_id uuid,
  p_student_id uuid default null,
  p_pa_best_of int default 2
)
returns table (
  student_id uuid,
  student_name text,
  student_code text,
  subject_id uuid,
  subject_name text,
  exam_group_id uuid,
  exam_group_name text,
  is_pa boolean,
  marks_obtained numeric,
  max_marks numeric,
  has_any_marks boolean,
  pa_rank int,
  included boolean,
  drop_reason text
)
language sql
stable
security invoker
as $$
  with selected as (
    -- All tests in the picked exam_groups, scoped to this class.
    -- One PA exam_group can have multiple tests for the same subject (e.g.,
    -- Written + Notebook + Enrichment). We aggregate them per subject below.
    select
      eg.id          as exam_group_id,
      eg.name        as exam_group_name,
      coalesce(eg.is_pa, false) as is_pa,
      t.id           as test_id,
      t.subject_id,
      coalesce(t.max_marks, 0)::numeric as max_marks
    from public.exam_groups eg
    join public.exam_group_tests egt on egt.exam_group_id = eg.id
    join public.tests t on t.id = egt.test_id
    where eg.id = any(coalesce(p_exam_group_ids, array[]::uuid[]))
      and t.class_instance_id = p_class_instance_id
  ),
  stu as (
    select s.id as student_id, s.full_name as student_name, s.student_code
    from public.student s
    where s.class_instance_id = p_class_instance_id
      and (p_student_id is null or s.id = p_student_id)
  ),
  -- Aggregate to (student, subject, exam_group): sum component-tests inside
  -- the same exam_group for the same subject.
  scored as (
    select
      stu.student_id,
      stu.student_name,
      stu.student_code,
      sel.subject_id,
      sel.exam_group_id,
      sel.exam_group_name,
      sel.is_pa,
      coalesce(sum(tm.marks_obtained), 0)::numeric as marks_obtained,
      coalesce(sum(sel.max_marks), 0)::numeric    as max_marks,
      bool_or(tm.test_id is not null)              as has_any_marks
    from stu
    cross join selected sel
    left join public.test_marks tm
      on tm.test_id = sel.test_id
     and tm.student_id = stu.student_id
    group by 1,2,3,4,5,6,7
  ),
  -- For PA rows, rank per (student, subject) by score-percent so best-of-N
  -- can keep the top N. Non-PA rows get a NULL rank (always included).
  ranked as (
    select
      sc.*,
      case
        when sc.is_pa and coalesce(p_pa_best_of, 0) > 0 then
          -- Partition includes is_pa so non-PA rows in the same (student,
          -- subject) partition don't consume row_number slots and inflate
          -- PA ranks.
          row_number() over (
            partition by sc.student_id, sc.subject_id, sc.is_pa
            order by
              case when sc.has_any_marks then 0 else 1 end,
              case
                when sc.has_any_marks and sc.max_marks > 0
                  then sc.marks_obtained / sc.max_marks
                else -1
              end desc,
              sc.exam_group_name
          )
        else null
      end as pa_rank
    from scored sc
  )
  select
    r.student_id,
    r.student_name,
    r.student_code,
    r.subject_id,
    subj.subject_name,
    r.exam_group_id,
    r.exam_group_name,
    r.is_pa,
    r.marks_obtained,
    r.max_marks,
    r.has_any_marks,
    r.pa_rank,
    case
      when r.is_pa
       and coalesce(p_pa_best_of, 0) > 0
       and r.pa_rank > p_pa_best_of
        then false
      else true
    end as included,
    case
      when r.is_pa
       and coalesce(p_pa_best_of, 0) > 0
       and r.pa_rank > p_pa_best_of
        then 'best_of_filtered'
      else null
    end as drop_reason
  from ranked r
  left join public.subjects subj on subj.id = r.subject_id
  order by r.student_name, subj.subject_name, r.is_pa desc, r.exam_group_name;
$$;

grant execute on function public.generate_clubbed_report(uuid[], uuid, uuid, int)
  to authenticated;

comment on function public.generate_clubbed_report(uuid[], uuid, uuid, int) is
  'Combines marks from multiple exam_groups into a single report. Applies best-of-N selection per (student, subject) to groups flagged is_pa. Non-PA groups are always included as-is.';
