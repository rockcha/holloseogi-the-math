-- Supabase SQL Editor에서 실행하세요. 반복 실행 가능합니다.
-- 기존 classes 테이블의 본인 수업 조회/수정 RLS 정책을 그대로 사용합니다.
begin;
alter table public.classes add column if not exists memo text;
comment on column public.classes.memo is '수업별 메모';
grant select (memo), update (memo) on public.classes to authenticated;
commit;
