-- Supabase SQL Editor에서 실행하세요. 반복 실행 가능합니다.
begin;
create table if not exists public.user_notes (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  content text not null default '' check (char_length(content) <= 10000)
);
alter table public.user_notes enable row level security;
drop policy if exists "Users read own note" on public.user_notes;
create policy "Users read own note" on public.user_notes for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users insert own note" on public.user_notes;
create policy "Users insert own note" on public.user_notes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users update own note" on public.user_notes;
create policy "Users update own note" on public.user_notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.user_notes from anon, authenticated;
grant select, insert, update on public.user_notes to authenticated;
commit;
