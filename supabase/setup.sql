-- ============================================================
--  SEEk Web User Test — database setup
--  Run once in Supabase: SQL Editor → New query → paste → Run.
--  Safe to run again (it skips things that already exist).
-- ============================================================

-- ---------- tables ----------
create table if not exists public.studies (
  id          text primary key,
  title       text not null,
  status      text not null default 'draft' check (status in ('draft', 'live', 'closed')),
  is_default  boolean not null default false,
  config      jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- only one study can be the default (the one the plain link opens)
create unique index if not exists studies_one_default on public.studies (is_default) where is_default;

create table if not exists public.sessions (
  id          uuid primary key,
  study_id    text not null references public.studies (id) on delete cascade,
  secret      text not null,
  data        jsonb not null,
  completed   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists sessions_study_idx on public.sessions (study_id, created_at desc);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------- helpers ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Testers save their own session through this function only.
-- A session can only be updated with the secret it was created with.
create or replace function public.save_session(p_id uuid, p_secret text, p_study text, p_data jsonb, p_completed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.studies where id = p_study and status = 'live') then
    raise exception 'This test is not open';
  end if;
  if octet_length(p_data::text) > 1000000 then
    raise exception 'Session too large';
  end if;
  if length(coalesce(p_secret, '')) < 16 then
    raise exception 'Bad secret';
  end if;
  insert into public.sessions (id, study_id, secret, data, completed)
  values (p_id, p_study, p_secret, p_data, coalesce(p_completed, false))
  on conflict (id) do update
    set data = excluded.data, completed = excluded.completed, updated_at = now()
    where public.sessions.secret = excluded.secret and public.sessions.study_id = excluded.study_id;
end;
$$;

-- Makes one study the default, clearing the old one
create or replace function public.set_default_study(p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.studies set is_default = false where is_default and id <> p_id;
  update public.studies set is_default = true, updated_at = now() where id = p_id;
end;
$$;

revoke all on function public.save_session(uuid, text, text, jsonb, boolean) from public;
grant execute on function public.save_session(uuid, text, text, jsonb, boolean) to anon, authenticated;
revoke all on function public.set_default_study(text) from public;
grant execute on function public.set_default_study(text) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- table access for the website (rows are still limited by the rules below) ----------
grant usage on schema public to anon, authenticated;
grant select on public.studies to anon, authenticated;
grant insert, update, delete on public.studies to authenticated;
grant select, delete on public.sessions to authenticated;
grant select on public.admins to authenticated;

-- ---------- row level security ----------
alter table public.studies  enable row level security;
alter table public.sessions enable row level security;
alter table public.admins   enable row level security;

drop policy if exists "read live studies or admin" on public.studies;
create policy "read live studies or admin" on public.studies
  for select to anon, authenticated using (status = 'live' or public.is_admin());

drop policy if exists "admins write studies" on public.studies;
create policy "admins write studies" on public.studies
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read sessions" on public.sessions;
create policy "admins read sessions" on public.sessions
  for select to authenticated using (public.is_admin());

drop policy if exists "admins delete sessions" on public.sessions;
create policy "admins delete sessions" on public.sessions
  for delete to authenticated using (public.is_admin());

drop policy if exists "see own admin row" on public.admins;
create policy "see own admin row" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ---------- storage for uploaded screens ----------
insert into storage.buckets (id, name, public)
values ('screens', 'screens', true)
on conflict (id) do nothing;

drop policy if exists "admins upload screens" on storage.objects;
create policy "admins upload screens" on storage.objects
  for insert to authenticated with check (bucket_id = 'screens' and public.is_admin());

drop policy if exists "admins update screens" on storage.objects;
create policy "admins update screens" on storage.objects
  for update to authenticated using (bucket_id = 'screens' and public.is_admin());

drop policy if exists "admins delete screens" on storage.objects;
create policy "admins delete screens" on storage.objects
  for delete to authenticated using (bucket_id = 'screens' and public.is_admin());
