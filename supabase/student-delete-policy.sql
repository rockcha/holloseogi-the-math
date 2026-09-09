-- Supabase SQL Editor에서 실행하세요. 기존 학생 데이터는 삭제하지 않습니다.
-- 기존 정책과 동일하게 승인된 교사에게만 학생 조회·삭제를 허용합니다.
begin;
alter table public.students enable row level security;
grant select, delete on public.students to authenticated;
drop policy if exists "Teachers can read students" on public.students;
create policy "Teachers can read students" on public.students for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_teacher is true));
drop policy if exists "Teachers can delete students" on public.students;
create policy "Teachers can delete students" on public.students for delete to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_teacher is true));
commit;
