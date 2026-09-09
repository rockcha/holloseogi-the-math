-- Supabase SQL Editor에서 실행하세요.
-- 기존 students 테이블과 students-policies.sql의 조회/등록 정책을 사용합니다.
-- 메모는 학생당 하나이며 승인된 교사들이 학생 정보와 함께 공유합니다.
begin;

alter table public.students add column if not exists memo text;
comment on column public.students.memo is '학생별 메모. 승인된 교사가 조회하고 수정합니다.';

alter table public.students enable row level security;
grant update (name, gender, phone, parent_phone, parent_relation, memo)
  on public.students to authenticated;

drop policy if exists "Teachers can update students" on public.students;
create policy "Teachers can update students"
on public.students for update
to authenticated
using (
  exists (
    select 1 from public.users
    where users.id = auth.uid() and users.is_teacher is true
  )
)
with check (
  exists (
    select 1 from public.users
    where users.id = auth.uid() and users.is_teacher is true
  )
);

commit;
