-- calendar_events 테이블을 이미 생성한 경우 실행하세요. 기존 일정은 유지됩니다.
alter table public.calendar_events
  add column if not exists memo text check (length(memo) <= 5000);
