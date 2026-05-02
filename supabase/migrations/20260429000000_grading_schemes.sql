-- Bind a grading_scale to an exam_group so MarksGrid + report cards know
-- which scale to apply. The grading_scales table already exists.
--
-- Existing scale.scale jsonb shape:
--   [{ "min": 90, "max": 100, "grade": "A1", "gpa": 9, "description": "Outstanding" }, ...]
--
-- Both min and max are inclusive bounds (use 100 as upper for the top band).

alter table public.exam_groups
  add column if not exists grading_scale_id uuid
    references public.grading_scales(id) on delete set null;

create index if not exists exam_groups_grading_scale_idx
  on public.exam_groups (grading_scale_id);
