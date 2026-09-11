begin;

-- =====================================================
-- 논술 일정 구조 개편
-- 한 row = 실제로 응시하는 하나의 시험 단위
--
-- 예)
-- 경희대 / 인문논술 / 인문 / 인문·체육계열 / 11-22 / 오전
-- 경희대 / 인문논술 / 사회 / 사회계열 / 11-22 / 오후
--
-- teacher_id 없음
-- =====================================================


-- =====================================================
-- 1. 기존 정책 제거
-- =====================================================

drop policy if exists "Teachers manage own essays"
on public.essays;

drop policy if exists "Teachers manage own essay students"
on public.essay_students;

drop policy if exists "Teachers manage essays"
on public.essays;

drop policy if exists "Teachers manage essay students"
on public.essay_students;


-- =====================================================
-- 2. 기존 save_essay 함수 제거
-- =====================================================

drop function if exists public.save_essay(
  uuid,
  text,
  text,
  text,
  date,
  text,
  uuid[]
);

drop function if exists public.save_essay(
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[]
);


-- =====================================================
-- 3. essays 테이블
-- =====================================================

create table if not exists public.essays (

  id uuid primary key default gen_random_uuid(),

  university_name text not null
    check (length(trim(university_name)) between 1 and 100),

  essay_type text not null
    check (essay_type in ('약술', '인문')),

  track text not null,

  -- 화면에서 같은 대학 내 시험을 구분하는 이름
  -- 예: 인문계열 / 사회계열 / 자연계열 / 창의형-인문사회
  schedule_name text not null default '',

  exam_date date not null,

  -- 정확한 시간이 확정되면 09:00, 14:00 등
  -- 아직 미확정이면 빈 문자열
  exam_time text not null default '',

  -- 이 시험을 보는 모집단위 묶음
  department_group text not null default '',

  -- 예: 제시문 비교·분석형 / 약술형 / 수리서술형
  question_format text not null default '',

  -- 예: 국어 8문항 + 수학 5문항 / 인문 제시문 + 도표
  subjects text not null default '',

  -- 예: 없음 / 국수영탐 중 1개 영역 3등급 이내
  minimum_requirement text not null default '',

  memo text not null default ''
    check (length(memo) <= 5000),

  created_at timestamptz not null default now()
);


-- teacher_id 제거
alter table public.essays
drop column if exists teacher_id;


-- =====================================================
-- 4. 기존 테이블에 신규 컬럼 추가
-- create table이 이미 존재했던 경우 대응
-- =====================================================

alter table public.essays
add column if not exists schedule_name text not null default '';

alter table public.essays
add column if not exists exam_time text not null default '';

alter table public.essays
add column if not exists department_group text not null default '';

alter table public.essays
add column if not exists question_format text not null default '';

alter table public.essays
add column if not exists subjects text not null default '';

alter table public.essays
add column if not exists minimum_requirement text not null default '';


-- =====================================================
-- 5. track 제약조건
-- =====================================================

alter table public.essays
drop constraint if exists essays_valid_track;

alter table public.essays
add constraint essays_valid_track
check (
  (essay_type = '약술' and track in ('인문', '자연'))
  or
  (essay_type = '인문' and track in ('인문', '사회', '자연'))
);


-- =====================================================
-- 6. 인덱스 / 중복 방지
-- =====================================================

drop index if exists public.essays_teacher_date_idx;

create index if not exists essays_exam_date_idx
on public.essays(exam_date);

create index if not exists essays_university_idx
on public.essays(university_name);

create index if not exists essays_type_track_idx
on public.essays(essay_type, track);

create index if not exists essays_university_date_idx
on public.essays(university_name, exam_date);

-- 같은 대학이라도 계열/시험명/날짜/시간이 다르면 별도 개체
-- 동일한 시험을 실수로 두 번 넣는 것은 방지
create unique index if not exists essays_schedule_unique_idx
on public.essays (
  university_name,
  essay_type,
  track,
  schedule_name,
  exam_date,
  exam_time
);


-- =====================================================
-- 7. essay_students
-- =====================================================

create table if not exists public.essay_students (

  essay_id uuid not null
    references public.essays(id)
    on delete cascade,

  student_id uuid not null
    references public.students(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  primary key (essay_id, student_id)
);

create index if not exists essay_students_student_idx
on public.essay_students(student_id);


-- =====================================================
-- 8. RLS
-- =====================================================

alter table public.essays enable row level security;
alter table public.essay_students enable row level security;

revoke all
on public.essays, public.essay_students
from anon;

grant select, insert, update, delete
on public.essays, public.essay_students
to authenticated;


create policy "Teachers manage essays"
on public.essays
for all
to authenticated
using (
  public.current_user_is_teacher()
)
with check (
  public.current_user_is_teacher()
);


create policy "Teachers manage essay students"
on public.essay_students
for all
to authenticated
using (
  public.current_user_is_teacher()
)
with check (
  public.current_user_is_teacher()
);


-- =====================================================
-- 9. save_essay
-- =====================================================

create function public.save_essay(

  p_id uuid,

  p_university_name text,
  p_essay_type text,
  p_track text,

  p_schedule_name text,

  p_exam_date date,
  p_exam_time text,

  p_department_group text,
  p_question_format text,
  p_subjects text,
  p_minimum_requirement text,

  p_memo text,

  p_student_ids uuid[]

)
returns uuid

language plpgsql
security invoker
set search_path = public

as $$

declare
  saved_id uuid;

begin

  if not public.current_user_is_teacher() then
    raise exception
      '교사 계정만 논술 일정을 저장할 수 있습니다.'
      using errcode = '42501';
  end if;


  if trim(coalesce(p_university_name, '')) = '' then
    raise exception '대학교명을 입력해 주세요.';
  end if;


  if trim(coalesce(p_schedule_name, '')) = '' then
    raise exception '시험 구분명을 입력해 주세요.';
  end if;


  -- 학생을 아직 지정하지 않는 경우 빈 배열 {} 허용
  if p_student_ids is null then
    p_student_ids := '{}'::uuid[];
  end if;


  -- 존재하지 않는 학생 ID 검사
  if exists (

    select 1
    from unnest(p_student_ids) s(id)

    where not exists (
      select 1
      from public.students st
      where st.id = s.id
    )

  ) then

    raise exception
      '선택한 학생을 찾을 수 없습니다. 학생 목록을 새로고침해 주세요.';

  end if;


  -- 신규 생성
  if p_id is null then

    insert into public.essays (

      university_name,
      essay_type,
      track,

      schedule_name,

      exam_date,
      exam_time,

      department_group,
      question_format,
      subjects,
      minimum_requirement,

      memo

    )
    values (

      trim(p_university_name),
      p_essay_type,
      p_track,

      trim(p_schedule_name),

      p_exam_date,
      trim(coalesce(p_exam_time, '')),

      trim(coalesce(p_department_group, '')),
      trim(coalesce(p_question_format, '')),
      trim(coalesce(p_subjects, '')),
      trim(coalesce(p_minimum_requirement, '')),

      coalesce(p_memo, '')

    )
    returning id into saved_id;


  else

    update public.essays

    set
      university_name = trim(p_university_name),
      essay_type = p_essay_type,
      track = p_track,

      schedule_name = trim(p_schedule_name),

      exam_date = p_exam_date,
      exam_time = trim(coalesce(p_exam_time, '')),

      department_group = trim(coalesce(p_department_group, '')),
      question_format = trim(coalesce(p_question_format, '')),
      subjects = trim(coalesce(p_subjects, '')),
      minimum_requirement = trim(coalesce(p_minimum_requirement, '')),

      memo = coalesce(p_memo, '')

    where id = p_id

    returning id into saved_id;


    if saved_id is null then
      raise exception '수정할 논술 일정을 찾을 수 없습니다.';
    end if;

  end if;


  -- 기존 학생 연결 중 선택 해제된 학생 제거
  delete from public.essay_students
  where essay_id = saved_id
    and not (student_id = any(p_student_ids));


  -- 학생 연결
  insert into public.essay_students (
    essay_id,
    student_id
  )
  select
    saved_id,
    id
  from (
    select distinct unnest(p_student_ids) as id
  ) s
  on conflict do nothing;


  return saved_id;

end;

$$;


-- =====================================================
-- 10. 함수 권한
-- =====================================================

revoke all
on function public.save_essay(
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[]
)
from public, anon;


grant execute
on function public.save_essay(
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[]
)
to authenticated;


commit;
