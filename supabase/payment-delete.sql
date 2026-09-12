-- 기존 payments.sql 적용 후 Supabase SQL Editor에서 실행하세요.
begin;

grant delete on public.payments to authenticated;

drop policy if exists "Teachers delete own payments" on public.payments;
create policy "Teachers delete own payments" on public.payments
for delete to authenticated
using (teacher_id = auth.uid() and public.current_user_is_teacher());

commit;
