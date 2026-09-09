-- Supabase SQL Editor에서 실행하세요. 반복 실행 가능합니다.
-- 기존 데이터는 변경하지 않으며, 새 등록·수정에 올바른 시간 규칙을 적용합니다.
begin;
alter table public.classes drop constraint if exists classes_start_time_check;
alter table public.classes drop constraint if exists classes_start_by_8am;
alter table public.classes drop constraint if exists classes_start_from_8am;
alter table public.classes add constraint classes_start_from_8am
  check (start_time >= time '08:00') not valid;
alter table public.classes drop constraint if exists classes_half_hour_times;
alter table public.classes add constraint classes_half_hour_times
  check (
    extract(minute from start_time) in (0, 30)
    and extract(second from start_time) = 0
    and extract(minute from end_time) in (0, 30)
    and extract(second from end_time) = 0
  ) not valid;
commit;
