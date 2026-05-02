-- Prevent duplicate subjects within the same exam_group + class.
-- Implemented as a trigger because the uniqueness key spans
-- exam_group_tests + tests, which a plain UNIQUE index can't express.

create or replace function public.enforce_unique_exam_group_subject()
returns trigger
language plpgsql
as $$
declare
  v_subject_id uuid;
  v_class_instance_id uuid;
  v_dup_count int;
begin
  select t.subject_id, t.class_instance_id
    into v_subject_id, v_class_instance_id
    from public.tests t
    where t.id = NEW.test_id;

  if v_subject_id is null then
    return NEW;
  end if;

  select count(*)
    into v_dup_count
    from public.exam_group_tests egt
    join public.tests t2 on t2.id = egt.test_id
    where egt.exam_group_id = NEW.exam_group_id
      and egt.id is distinct from NEW.id
      and t2.subject_id = v_subject_id
      and t2.class_instance_id is not distinct from v_class_instance_id;

  if v_dup_count > 0 then
    raise exception
      'Subject already added to this exam group for this class'
      using errcode = '23505';
  end if;

  return NEW;
end;
$$;

drop trigger if exists exam_group_tests_unique_subject on public.exam_group_tests;
create trigger exam_group_tests_unique_subject
  before insert or update on public.exam_group_tests
  for each row execute function public.enforce_unique_exam_group_subject();
