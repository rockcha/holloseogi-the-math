-- Supabase SQL Editor에서 실행하세요. 여러 번 실행해도 안전합니다.
alter table public.students enable row level security;

drop policy if exists "Teachers can read students" on public.students;
create policy "Teachers can read students"
on public.students for select
to authenticated
using (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.is_teacher is true
  )
);

drop policy if exists "Teachers can create students" on public.students;
create policy "Teachers can create students"
on public.students for insert
to authenticated
with check (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.is_teacher is true
  )
);

drop policy if exists "Teachers can delete students" on public.students;
create policy "Teachers can delete students"
on public.students for delete
to authenticated
using (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.is_teacher is true
  )
);

-- 로그인 사용자가 자신의 교사 여부를 읽을 수 있게 합니다.
alter table public.users enable row level security;
drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
on public.users for select
to authenticated
using (id = auth.uid());
