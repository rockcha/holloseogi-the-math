-- 기존 classes.sql의 current_user_is_teacher() 함수가 있는 프로젝트에서 실행합니다.
-- 요일은 월=1 ... 일=7. 기존 수업 데이터는 변경하지 않습니다.
begin;
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 100),
  weekdays smallint[] not null check (cardinality(weekdays) between 1 and 7 and array_position(weekdays, null) is null and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  start_time time not null,
  end_time time not null,
  color_index smallint not null default 0 check (color_index between 0 and 9),
  memo text check (length(memo) <= 5000),
  created_at timestamptz not null default now(),
  constraint schedules_end_after_start check (end_time > start_time),
  constraint schedules_minute_times check (extract(second from start_time) = 0 and extract(second from end_time) = 0)
);
create index if not exists schedules_teacher_id_idx on public.schedules(teacher_id);
alter table public.schedules enable row level security;
revoke all on public.schedules from anon;
grant select, insert, update, delete on public.schedules to authenticated;

drop policy if exists "Teachers read schedules" on public.schedules;
create policy "Teachers read schedules" on public.schedules for select to authenticated
using (public.current_user_is_teacher());
drop policy if exists "Teachers create own schedules" on public.schedules;
create policy "Teachers create own schedules" on public.schedules for insert to authenticated
with check (teacher_id = auth.uid() and public.current_user_is_teacher());
drop policy if exists "Teachers update own schedules" on public.schedules;
create policy "Teachers update own schedules" on public.schedules for update to authenticated
using (teacher_id = auth.uid() and public.current_user_is_teacher())
with check (teacher_id = auth.uid() and public.current_user_is_teacher());
drop policy if exists "Teachers delete own schedules" on public.schedules;
create policy "Teachers delete own schedules" on public.schedules for delete to authenticated
using (teacher_id = auth.uid() and public.current_user_is_teacher());
commit;
