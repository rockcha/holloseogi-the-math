-- 출석부와 학생별 출석 기록입니다. Supabase SQL Editor에서 실행하세요.
create table if not exists public.attendance_sheets (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  attendance_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, attendance_date)
);

create table if not exists public.attendance_records (
  sheet_id uuid not null references public.attendance_sheets(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null check (status in ('present', 'late', 'absent')),
  note text,
  created_at timestamptz not null default now(),
  primary key (sheet_id, student_id)
);

create index if not exists attendance_sheets_class_date_idx on public.attendance_sheets(class_id, attendance_date desc);
create index if not exists attendance_records_student_idx on public.attendance_records(student_id);

-- 기존 지각 기록은 결석으로 통합하고 앞으로 출석/결석만 저장합니다.
update public.attendance_records set status = 'absent' where status = 'late';
alter table public.attendance_records drop constraint if exists attendance_records_status_check;
alter table public.attendance_records add constraint attendance_records_status_check check (status in ('present', 'absent'));

alter table public.attendance_sheets enable row level security;
alter table public.attendance_records enable row level security;

drop policy if exists "Teachers manage own attendance sheets" on public.attendance_sheets;
create policy "Teachers manage own attendance sheets" on public.attendance_sheets
for all to authenticated
using (exists (select 1 from public.classes c where c.id = attendance_sheets.class_id and c.teacher_id = auth.uid()) and public.current_user_is_teacher())
with check (exists (select 1 from public.classes c where c.id = attendance_sheets.class_id and c.teacher_id = auth.uid()) and public.current_user_is_teacher());

drop policy if exists "Teachers manage own attendance records" on public.attendance_records;
create policy "Teachers manage own attendance records" on public.attendance_records
for all to authenticated
using (exists (select 1 from public.attendance_sheets s join public.classes c on c.id = s.class_id where s.id = attendance_records.sheet_id and c.teacher_id = auth.uid()) and public.current_user_is_teacher())
with check (exists (select 1 from public.attendance_sheets s join public.classes c on c.id = s.class_id where s.id = attendance_records.sheet_id and c.teacher_id = auth.uid()) and public.current_user_is_teacher());
