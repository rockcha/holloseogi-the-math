-- Apply after payments.sql. Allows class receipts without a billing start date.
begin;

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
