-- 매주 반복되는 수업. weekdays는 월=1 ... 일=7 입니다.
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  start_time time not null,
  end_time time not null,
  weekdays smallint[] not null check (cardinality(weekdays) > 0 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  color_index smallint not null default 0 check (color_index between 0 and 9),
  created_at timestamptz not null default now()
);

-- 기존 classes 테이블과 데이터가 있을 때 종료 시간을 안전하게 추가합니다.
alter table public.classes add column if not exists end_time time;
update public.classes
set end_time = start_time + make_interval(mins => coalesce(duration_minutes, 60))
where end_time is null;
alter table public.classes alter column end_time set not null;

alter table public.classes drop constraint if exists classes_end_after_start;
alter table public.classes
  add constraint classes_end_after_start check (end_time > start_time);

-- Supabase SQL Editor에서 실행하세요. 반복 실행 가능합니다.
-- 기존 데이터는 변경하지 않으며, 새 등록·수정에 올바른 시간 규칙을 적용합니다.

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


create index if not exists classes_teacher_id_idx on public.classes(teacher_id);
alter table public.classes enable row level security;

alter table public.classes add column if not exists color_index smallint not null default 0;
alter table public.classes drop constraint if exists classes_color_index_check;
alter table public.classes add constraint classes_color_index_check check (color_index between 0 and 9);

-- 기존 수업도 선생님별 생성 순서에 따라 10가지 색으로 나눕니다.
with numbered as (
  select id, mod(row_number() over (partition by teacher_id order by created_at, id) - 1, 10)::smallint as new_color
  from public.classes
)
update public.classes c
set color_index = numbered.new_color
from numbered
where c.id = numbered.id;

create or replace function public.current_user_is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.is_teacher from public.users u where u.id = auth.uid()),
    false
  );
$$;

revoke all on function public.current_user_is_teacher() from public;
grant execute on function public.current_user_is_teacher() to authenticated;

drop policy if exists "Teachers can read own classes" on public.classes;
create policy "Teachers can read own classes"
on public.classes for select to authenticated
using (teacher_id = auth.uid() and public.current_user_is_teacher());

drop policy if exists "Teachers can create own classes" on public.classes;
create policy "Teachers can create own classes"
on public.classes for insert to authenticated
with check (teacher_id = auth.uid() and public.current_user_is_teacher());

drop policy if exists "Teachers can update own classes" on public.classes;
create policy "Teachers can update own classes"
on public.classes for update to authenticated
using (teacher_id = auth.uid() and public.current_user_is_teacher())
with check (teacher_id = auth.uid() and public.current_user_is_teacher());

drop policy if exists "Teachers can delete own classes" on public.classes;
create policy "Teachers can delete own classes"
on public.classes for delete to authenticated
using (teacher_id = auth.uid() and public.current_user_is_teacher());

-- 동시에 요청이 들어와도 같은 교사의 수업 시간이 겹치지 않도록 DB에서도 검사합니다.
create or replace function public.prevent_class_time_conflict()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.classes c
    where c.teacher_id = new.teacher_id
      and c.id <> new.id
      and c.weekdays && new.weekdays
      and c.start_time < new.end_time
      and c.end_time > new.start_time
  ) then
    raise exception 'class_time_conflict' using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_class_time_conflict_trigger on public.classes;
create trigger prevent_class_time_conflict_trigger
before insert or update on public.classes
for each row execute function public.prevent_class_time_conflict();
