-- 수업과 학생의 다대다 배정 테이블입니다. Supabase SQL Editor에서 한 번 실행하세요.
create table if not exists public.class_students (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create index if not exists class_students_student_id_idx
  on public.class_students(student_id);

alter table public.class_students enable row level security;

drop policy if exists "Teachers can read own class students" on public.class_students;
create policy "Teachers can read own class students"
on public.class_students for select to authenticated
using (
  public.current_user_is_teacher()
  and exists (
    select 1 from public.classes
    where classes.id = class_students.class_id
      and classes.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can add own class students" on public.class_students;
create policy "Teachers can add own class students"
on public.class_students for insert to authenticated
with check (
  public.current_user_is_teacher()
  and exists (
    select 1 from public.classes
    where classes.id = class_students.class_id
      and classes.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can remove own class students" on public.class_students;
create policy "Teachers can remove own class students"
on public.class_students for delete to authenticated
using (
  public.current_user_is_teacher()
  and exists (
    select 1 from public.classes
    where classes.id = class_students.class_id
      and classes.teacher_id = auth.uid()
  )
);
