-- generate_annual_report
--
-- Single-query computation of an Annual Term-End Report for a class.
-- Takes a list of term_report ids (e.g., [Term 1, Term 2]) and returns one
-- row per (student, subject, source_term_report). Each cell carries the
-- doubly-halved marks: source term's per-subject score (which is itself
-- best-PA-÷2 + sum of term exams) divided by 2 again for the annual.
--
-- Replaces the previous client-side approach of running buildTermReportCardData
-- per student, which required ~10 round-trips × N students = slow on real
-- class sizes. This is one round-trip regardless of class size.

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
  has_any_marks boolean
)
language sql
stable
security invoker
as $$
  -- 1. Resolve the term_reports (validated to be kind='term_report') and the
  --    assessment exam_groups they reference. Preserve order via with-ordinality.
  with picked_terms as (
    select
      tr.id   as term_report_id,
      tr.name as term_report_name,
      tr_idx.ord::int as term_report_sequence
    from unnest(coalesce(p_term_report_ids, array[]::uuid[]))
         with ordinality as tr_idx(id, ord)
    join public.exam_groups tr
      on tr.id = tr_idx.id
     and tr.kind = 'term_report'
  ),
  -- 2. Fan out: each term_report → its source assessment exam_groups (PA + term).
  picked_assessments as (
    select
      pt.term_report_id,
      pt.term_report_name,
      pt.term_report_sequence,
      eg.id   as exam_group_id,
      coalesce(eg.is_pa, false) as is_pa
    from picked_terms pt
    join public.exam_groups src_tr on src_tr.id = pt.term_report_id
    cross join lateral unnest(coalesce(src_tr.source_group_ids, array[]::uuid[])) as src_id(id)
    join public.exam_groups eg
      on eg.id = src_id.id
     and eg.kind = 'assessment'
  ),
  -- 3. Tests under each picked assessment, restricted to the target class.
  --    A term_report can have any number of source assessments; each assessment
  --    can have multiple component tests for the same subject (e.g., a PA with
  --    Written + Notebook + Enrichment). We sum component tests per
  --    (assessment, subject) below.
  selected as (
    select
      pa.term_report_id,
      pa.term_report_name,
      pa.term_report_sequence,
      pa.exam_group_id,
      pa.is_pa,
      t.id           as test_id,
      t.subject_id,
      coalesce(t.max_marks, 0)::numeric as max_marks
    from picked_assessments pa
    join public.exam_group_tests egt on egt.exam_group_id = pa.exam_group_id
    join public.tests t on t.id = egt.test_id
    where t.class_instance_id = p_class_instance_id
  ),
  stu as (
    select s.id as student_id, s.full_name as student_name, s.student_code
    from public.student s
    where s.class_instance_id = p_class_instance_id
      and (p_student_id is null or s.id = p_student_id)
  ),
  -- 4. Aggregate to (student, term_report, exam_group, subject): sum of
  --    component-test marks for that subject in that exam_group.
  --    LEFT JOIN test_marks so missing marks become 0/0 cleanly.
  scored as (
    select
      stu.student_id,
      stu.student_name,
      stu.student_code,
      sel.term_report_id,
      sel.term_report_name,
      sel.term_report_sequence,
      sel.exam_group_id,
      sel.is_pa,
      sel.subject_id,
      coalesce(sum(tm.marks_obtained), 0)::numeric as marks_obtained,
      coalesce(sum(sel.max_marks), 0)::numeric    as max_marks,
      bool_or(tm.test_id is not null)              as has_any_marks
    from stu
    cross join selected sel
    left join public.test_marks tm
      on tm.test_id = sel.test_id
     and tm.student_id = stu.student_id
    group by 1,2,3,4,5,6,7,8,9
  ),
  -- 5. Within each (student, term_report, subject), pick the single best PA
  --    by percentage. Non-PA rows always pass through.
  ranked_pa as (
    select
      sc.*,
      case when sc.is_pa then
        row_number() over (
          partition by sc.student_id, sc.term_report_id, sc.subject_id
          order by
            case when sc.has_any_marks then 0 else 1 end,
            case
              when sc.has_any_marks and sc.max_marks > 0
                then sc.marks_obtained / sc.max_marks
              else -1
            end desc,
            sc.exam_group_id  -- stable tiebreak
        )
      else null end as pa_rank
    from scored sc
  ),
  -- 6. Per (student, term_report, subject):
  --      best_pa_marks = the rank-1 PA's marks
  --      best_pa_max   = the rank-1 PA's max
  --      term_marks    = sum of all non-PA rows' marks
  --      term_max      = sum of all non-PA rows' maxes
  per_term_subject as (
    select
      r.student_id,
      r.student_name,
      r.student_code,
      r.term_report_id,
      r.term_report_name,
      r.term_report_sequence,
      r.subject_id,
      sum(case when r.is_pa and r.pa_rank = 1 then r.marks_obtained else 0 end) as best_pa_marks,
      sum(case when r.is_pa and r.pa_rank = 1 then r.max_marks      else 0 end) as best_pa_max,
      sum(case when not r.is_pa then r.marks_obtained else 0 end)               as term_marks,
      sum(case when not r.is_pa then r.max_marks      else 0 end)               as term_max,
      bool_or(r.has_any_marks)                                                  as has_any_marks
    from ranked_pa r
    group by 1,2,3,4,5,6,7
  ),
  -- 7. Apply the FIRST halve (best PA halved within the term report) and the
  --    SECOND halve (the annual report halves the term-report's per-subject score).
  --    Mid-term per-subject score = (best_pa_marks / 2) + term_marks
  --    Annual halved score        = mid-term per-subject score / 2
  --    Combined: annual_halved_marks = (best_pa_marks / 2 + term_marks) / 2
  --                                  = best_pa_marks / 4 + term_marks / 2
  --    Same for max.
  annualised as (
    select
      pts.*,
      ((pts.best_pa_marks / 2.0) + pts.term_marks) / 2.0 as halved_marks,
      ((pts.best_pa_max   / 2.0) + pts.term_max)   / 2.0 as halved_max
    from per_term_subject pts
  )
  select
    a.student_id,
    a.student_name,
    a.student_code,
    a.subject_id,
    sub.subject_name,
    a.term_report_id,
    a.term_report_name,
    a.term_report_sequence,
    -- Round to 2 decimals; matches client-side display
    round(a.halved_marks::numeric, 2) as halved_marks,
    round(a.halved_max::numeric,   2) as halved_max,
    a.has_any_marks
  from annualised a
  left join public.subjects sub on sub.id = a.subject_id
  order by a.student_name, sub.subject_name, a.term_report_sequence;
$$;

grant execute on function public.generate_annual_report(uuid[], uuid, uuid)
  to authenticated;

comment on function public.generate_annual_report(uuid[], uuid, uuid) is
  'Annual Term-End Report aggregator. Takes term_report ids, computes per-student per-subject halved scores in a single query. Math: ((best_PA / 2) + term_sum) / 2 per source term, returned per-cell.';
