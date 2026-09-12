-- payments.sql 및 기존 결제 관련 SQL 적용 후 SQL Editor에서 실행하세요.
begin;

-- 변경 가능한 입력값만 허용합니다. 작성자와 생성일, 과거 금액 스냅샷은 보호합니다.
grant update (student_id, class_id, cycle_number, amount, paid_on) on public.payments to authenticated;

drop policy if exists "Teachers update own payments" on public.payments;
create policy "Teachers update own payments" on public.payments
for update to authenticated
using (teacher_id = auth.uid() and public.current_user_is_teacher())
with check (teacher_id = auth.uid() and public.current_user_is_teacher());

create or replace function public.prepare_payment_edit()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.paid_on > (now() at time zone 'Asia/Seoul')::date then
    raise exception '결제일은 오늘 또는 이전 날짜여야 합니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_payment_edit_trigger on public.payments;
create trigger validate_payment_edit_trigger before update on public.payments
for each row execute function public.prepare_payment_edit();

drop trigger if exists prepare_payment_edit_trigger on public.payments;
-- 금액/날짜만 고치는 경우 수강 종료 학생도 수정할 수 있으며 기존 스냅샷을 보존합니다.
-- 연결을 바꾸면 기존 등록용 함수가 수강 여부를 검증하고 주기 스냅샷을 다시 계산합니다.
create trigger prepare_payment_edit_trigger before update on public.payments
for each row when (
  (new.student_id, new.class_id, new.cycle_number)
    is distinct from (old.student_id, old.class_id, old.cycle_number)
)
execute function public.prepare_payment();

commit;
