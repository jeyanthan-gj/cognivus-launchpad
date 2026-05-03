-- Migration: server-side security hardening
-- Adds:
--   1. login_attempts table for server-side rate limiting (complements client-side)
--   2. A lightweight cleanup function for expired attempts

-- ── Login attempts tracking ───────────────────────────────────────────────────
-- Tracks failed sign-in attempts by IP/identifier to enforce server-side
-- rate limits independent of the client.  Rows auto-expire via cleanup_login_attempts().

create table if not exists public.login_attempts (
  id          uuid primary key default gen_random_uuid(),
  identifier  text not null,           -- hashed email or IP — NOT plaintext
  attempted_at timestamptz not null default now()
);

create index if not exists login_attempts_identifier_idx
  on public.login_attempts (identifier, attempted_at desc);

alter table public.login_attempts enable row level security;

-- No SELECT/INSERT policy for authenticated users — this table is only
-- ever touched via service-role server functions. Anon users have no access.
create policy "No direct access to login_attempts" on public.login_attempts
  as restrictive
  for all
  using (false);

-- Cleanup function: removes attempts older than 15 minutes.
-- Call periodically via pg_cron or invoke from a server function after each check.
create or replace function public.cleanup_login_attempts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_attempts
  where attempted_at < now() - interval '15 minutes';
$$;

revoke all on function public.cleanup_login_attempts() from public, anon, authenticated;

-- ── Enforce password change on first login ────────────────────────────────────
-- The user_roles table gains a must_change_password flag.
-- The provisioning script sets this to true; the Account page clears it on save.
alter table public.user_roles
  add column if not exists must_change_password boolean not null default false;

-- Admins can see and clear their own flag via the account page (uses auth client, not service key)
create policy "Users can view their own must_change_password" on public.user_roles
  for select using (auth.uid() = user_id);

-- (Update is handled server-side via service role only — no client update policy needed)
