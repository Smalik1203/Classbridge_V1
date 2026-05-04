-- Fix bug in generate_clubbed_report: pa_rank window was partitioning only
-- by (student_id, subject_id), so non-PA rows in the same partition consumed
-- row_number() slots and inflated PA ranks. Example: with PA-1, PA-2, and
-- one non-PA exam in the picked set, PA-1 ranked 2 and PA-2 ranked 3 — and
-- best-of-2 wrongly dropped PA-2.
--
-- Fix: include is_pa in the partition so PA rows rank only against other
-- PA rows for the same (student, subject).
--
-- This migration is a no-op for any deployment that ran the corrected
-- 20260503000000_clubbed_reports.sql migration; it's kept for repos that
-- already applied the original.

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
  ranked as (
    select
      sc.*,
      case
        when sc.is_pa and coalesce(p_pa_best_of, 0) > 0 then
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
