-- 기존 classes.sql, class-students.sql, students-policies.sql 적용 후
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요. 기존 수업의 시작일은 직접 설정합니다.
begin;

alter table public.classes
  add column if not exists billing_cycle_sessions integer not null default 8,
  add column if not exists billing_amount integer not null default 0,
  add column if not exists billing_start_date date;

alter table public.classes drop constraint if exists classes_billing_valid;
alter table public.classes add constraint classes_billing_valid check (
  billing_cycle_sessions between 1 and 365
  and billing_amount >= 0
  and (billing_start_date is null or extract(isodow from billing_start_date)::smallint = any(weekdays))
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  amount integer not null check (amount > 0),
  paid_on date not null,
  -- NULL이면 일반 결제. 결제일과 납부 대상 주기는 독립적입니다 (선납/후납 가능).
  class_id uuid references public.classes(id) on delete restrict,
  cycle_number integer check (cycle_number between 1 and 10000),
  cycle_start date,
  cycle_end date,
  expected_amount integer,
  created_at timestamptz not null default now(),
  constraint payments_cycle_complete check (
    (class_id is null and cycle_number is null and cycle_start is null and cycle_end is null and expected_amount is null)
    or (class_id is not null and cycle_number is not null and cycle_start is not null and cycle_end is not null and expected_amount is not null)
  )
);

create index if not exists payments_teacher_date_idx on public.payments(teacher_id, paid_on desc, id);
create index if not exists payments_class_cycle_student_idx on public.payments(class_id, cycle_number, student_id);
create index if not exists payments_student_idx on public.payments(student_id);
alter table public.payments enable row level security;

drop policy if exists "Teachers read own payments" on public.payments;
create policy "Teachers read own payments" on public.payments for select to authenticated
using (teacher_id = auth.uid() and public.current_user_is_teacher());

drop policy if exists "Teachers add own payments" on public.payments;
create policy "Teachers add own payments" on public.payments for insert to authenticated
with check (
  teacher_id = auth.uid() and public.current_user_is_teacher()
  and exists (select 1 from public.students s where s.id = payments.student_id)
  and (class_id is null or exists (
    select 1 from public.classes c join public.class_students cs on cs.class_id = c.id
    where c.id = payments.class_id and c.teacher_id = auth.uid() and cs.student_id = payments.student_id
  ))
);

grant select, insert on public.payments to authenticated;
revoke update, delete on public.payments from authenticated;

-- 클라이언트가 보낸 날짜/금액 스냅샷을 신뢰하지 않고 DB에서 계산합니다.
create or replace function public.prepare_payment()
returns trigger language plpgsql set search_path = public as $$
declare
  lesson public.classes%rowtype;
  offsets integer[];
  weekly_count integer;
  first_index integer;
  last_index integer;
begin
  if new.paid_on > (now() at time zone 'Asia/Seoul')::date then
    raise exception '결제일은 오늘 또는 이전 날짜여야 합니다.';
  end if;
  if new.class_id is null then
    new.cycle_number := null;
    new.cycle_start := null;
    new.cycle_end := null;
    new.expected_amount := null;
    return new;
  end if;

  -- 설정 변경과 결제 추가를 같은 수업 행의 잠금으로 직렬화합니다.
  select * into lesson from public.classes
  where id = new.class_id and teacher_id = auth.uid() for update;
  if not found then
    raise exception '접근할 수 없는 수업입니다.';
  end if;
  if not exists (select 1 from public.class_students where class_id = new.class_id and student_id = new.student_id) then
    raise exception '수업에 참여 중인 학생을 선택해 주세요.';
  end if;
  if lesson.billing_start_date is null then
    new.cycle_number := null;
    new.cycle_start := null;
    new.cycle_end := null;
    new.expected_amount := null;
    return new;
  end if;
  if new.cycle_number is null or new.cycle_number not between 1 and 10000 then
    raise exception '결제 주기 번호는 1~10,000 사이여야 합니다.';
  end if;
  select array_agg(day_offset order by day_offset) into offsets
  from generate_series(0, 6) as days(day_offset)
  where extract(isodow from lesson.billing_start_date + day_offset)::smallint = any(lesson.weekdays);
  weekly_count := cardinality(offsets);
  first_index := (new.cycle_number - 1) * lesson.billing_cycle_sessions;
  last_index := first_index + lesson.billing_cycle_sessions - 1;
  new.cycle_start := lesson.billing_start_date + (first_index / weekly_count) * 7 + offsets[(first_index % weekly_count) + 1];
  new.cycle_end := lesson.billing_start_date + (last_index / weekly_count) * 7 + offsets[(last_index % weekly_count) + 1];
  new.expected_amount := lesson.billing_amount;
  return new;
end;
$$;

drop trigger if exists prepare_payment_trigger on public.payments;
create trigger prepare_payment_trigger before insert on public.payments
for each row execute function public.prepare_payment();

-- 기존 결제의 주기/금액을 소급해서 바꾸지 않습니다. 결제 내역도 삭제 시 보존합니다.
create or replace function public.protect_paid_class_billing()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.billing_cycle_sessions, new.billing_amount, new.billing_start_date, new.weekdays, new.teacher_id)
    is distinct from (old.billing_cycle_sessions, old.billing_amount, old.billing_start_date, old.weekdays, old.teacher_id)
    and exists (select 1 from public.payments where class_id = old.id and cycle_number is not null) then
    raise exception '결제 내역이 있는 수업의 요일과 결제 설정은 변경할 수 없어요. 새로운 조건은 새 수업으로 등록해 주세요.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_paid_class_billing_trigger on public.classes;
create trigger protect_paid_class_billing_trigger before update on public.classes
for each row execute function public.protect_paid_class_billing();

-- 주기 미지정 결제는 수업 연결을 유지하고, 이후 시작일 설정도 허용합니다.
alter table public.payments drop constraint if exists payments_cycle_complete;
alter table public.payments add constraint payments_cycle_complete check (
  (cycle_number is null and cycle_start is null and cycle_end is null and expected_amount is null)
  or (class_id is not null and cycle_number is not null and cycle_start is not null and cycle_end is not null and expected_amount is not null)
);

commit;
