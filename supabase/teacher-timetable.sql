-- classes.sql 적용 후 실행하세요.
-- 교사 선택에 필요한 이름과 시간표 정보만 반환합니다.
-- 기존 쓰기 권한 및 학생·출석·결제 정책은 변경하지 않습니다.
begin;
create or replace function public.get_teacher_directory()
returns table (id uuid, nickname text)
language sql stable security definer set search_path = ''
as $$
  select u.id, coalesce(nullif(trim(u.nickname::text), ''), '이름 미등록')
  from public.users u
  where u.is_teacher = true and public.current_user_is_teacher()
  order by u.nickname, u.id;
$$;
revoke all on function public.get_teacher_directory() from public, anon;
grant execute on function public.get_teacher_directory() to authenticated;

create or replace function public.get_teacher_timetable(selected_teacher_id uuid)
returns table (id uuid, teacher_id uuid, name text, start_time time, end_time time, weekdays smallint[], color_index integer)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.teacher_id, c.name::text, c.start_time, c.end_time, c.weekdays::smallint[], c.color_index::integer
  from public.classes c
  where c.teacher_id = selected_teacher_id and public.current_user_is_teacher()
    and exists (select 1 from public.users u where u.id = c.teacher_id and u.is_teacher = true)
  order by c.start_time, c.name, c.id;
$$;
revoke all on function public.get_teacher_timetable(uuid) from public, anon;
grant execute on function public.get_teacher_timetable(uuid) to authenticated;
commit;
