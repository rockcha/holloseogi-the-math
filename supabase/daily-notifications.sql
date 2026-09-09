-- classes.sql, schedules.sql, calendar-events.sql 적용 후 실행하세요.
-- 한국 시간 오전 8시 이후 앱 접속/조회 시 오늘의 알림을 생성합니다.
-- 휴대폰 푸시나 백그라운드 발송용 스케줄러는 사용하지 않습니다.
begin;
create table if not exists public.daily_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_date date not null,
  class_count integer not null check (class_count >= 0),
  schedule_count integer not null check (schedule_count >= 0),
  scheduled_at timestamptz not null,
  read_at timestamptz,
  unique (user_id, notification_date)
);
alter table public.daily_notifications enable row level security;
revoke all on public.daily_notifications from anon, authenticated;
grant select on public.daily_notifications to authenticated;
grant update (read_at) on public.daily_notifications to authenticated;
drop policy if exists "Users read own daily notifications" on public.daily_notifications;
create policy "Users read own daily notifications" on public.daily_notifications for select to authenticated
using (user_id = auth.uid() and public.current_user_is_teacher());
drop policy if exists "Users mark own daily notifications read" on public.daily_notifications;
create policy "Users mark own daily notifications read" on public.daily_notifications for update to authenticated
using (user_id = auth.uid() and public.current_user_is_teacher())
with check (user_id = auth.uid() and public.current_user_is_teacher());

create or replace function public.get_today_notification()
returns setof public.daily_notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  korea_now timestamp := now() at time zone 'Asia/Seoul';
  today date := korea_now::date;
  weekday integer := extract(isodow from korea_now)::integer;
  lesson_total integer;
  repeating_total integer;
  dated_total integer;
begin
  if viewer_id is null or not public.current_user_is_teacher() or korea_now::time < time '08:00' then
    return;
  end if;
  select count(*)::integer into lesson_total from public.classes
    where teacher_id = viewer_id and weekday = any(weekdays);
  select count(*)::integer into repeating_total from public.schedules
    where teacher_id = viewer_id and weekday = any(weekdays);
  select count(*)::integer into dated_total from public.calendar_events
    where teacher_id = viewer_id and event_date = today;

  -- 오늘 일정이 수정되면 숫자만 갱신하고 이미 읽은 상태는 유지합니다.
  insert into public.daily_notifications (user_id, notification_date, class_count, schedule_count, scheduled_at)
    values (viewer_id, today, lesson_total, repeating_total + dated_total,
      (today + time '08:00') at time zone 'Asia/Seoul')
    on conflict (user_id, notification_date) do update
      set class_count = excluded.class_count, schedule_count = excluded.schedule_count
      where daily_notifications.class_count is distinct from excluded.class_count
         or daily_notifications.schedule_count is distinct from excluded.schedule_count;

  return query select n.* from public.daily_notifications n
    where n.user_id = viewer_id and n.notification_date = today;
end;
$$;
revoke all on function public.get_today_notification() from public, anon;
grant execute on function public.get_today_notification() to authenticated;
commit;
