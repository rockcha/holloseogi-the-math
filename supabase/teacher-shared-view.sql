-- 기존 classes / class-students / attendance / payments SQL 적용 후 실행합니다.
-- 생성한 교사(teacher_id)가 담당자입니다. 기존 담당자와 쓰기 정책은 유지합니다.
begin;
drop policy if exists "Teachers read all classes" on public.classes;
create policy "Teachers read all classes" on public.classes for select to authenticated
using (public.current_user_is_teacher());
drop policy if exists "Teachers read all class students" on public.class_students;
create policy "Teachers read all class students" on public.class_students for select to authenticated
using (public.current_user_is_teacher());
drop policy if exists "Teachers read all attendance sheets" on public.attendance_sheets;
create policy "Teachers read all attendance sheets" on public.attendance_sheets for select to authenticated
using (public.current_user_is_teacher());
drop policy if exists "Teachers read all attendance records" on public.attendance_records;
create policy "Teachers read all attendance records" on public.attendance_records for select to authenticated
using (public.current_user_is_teacher());
drop policy if exists "Teachers read all class payments" on public.payments;
create policy "Teachers read all class payments" on public.payments for select to authenticated
using (class_id is not null and public.current_user_is_teacher());
commit;
