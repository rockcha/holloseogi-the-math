-- 기존 classes.sql 적용 후 Supabase SQL Editor에서 실행합니다.
-- 시간표의 반복 일정(schedules)과 별도로 날짜별 일정을 저장합니다.
begin;
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 100),
  event_date date not null,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  constraint calendar_events_times check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time
      and extract(second from start_time) = 0 and extract(second from end_time) = 0)
  )
);
alter table public.calendar_events add column if not exists memo text check (length(memo) <= 5000);
create index if not exists calendar_events_teacher_date_idx on public.calendar_events(teacher_id, event_date);
alter table public.calendar_events enable row level security;
revoke all on public.calendar_events from anon;
grant select, insert, update, delete on public.calendar_events to authenticated;
drop policy if exists "Teachers manage own calendar events" on public.calendar_events;
create policy "Teachers manage own calendar events" on public.calendar_events for all to authenticated
using (teacher_id = auth.uid() and public.current_user_is_teacher())
with check (teacher_id = auth.uid() and public.current_user_is_teacher());
commit;
