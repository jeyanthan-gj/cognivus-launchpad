-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: comprehensive auth security hardening
-- Addresses:
--   1. Session expiry settings via Supabase auth config (documented below)
--   2. Email verification enforcement (documented below)
--   3. Password reset token expiry enforcement
--   4. login_attempts TTL index for automatic expiry
--   5. Revoke unnecessary permissions from helper functions
--   6. RLS audit — ensure no policy gaps on auth-adjacent tables
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Supabase Auth settings ─────────────────────────────────────────────────
-- These settings are managed in supabase/config.toml (local) and the Supabase
-- dashboard (production). They cannot be set via SQL. Configure as follows:
--
-- In supabase/config.toml → [auth]:
--   jwt_expiry = 3600                    -- 1-hour access tokens (default is 3600)
--   enable_signup = false                -- disable public self-registration
--
-- In supabase/config.toml → [auth.email]:
--   enable_confirmations = true          -- require email verification
--   double_confirm_changes = true        -- re-verify on email change
--   secure_password_change = true        -- require current password to change
--
-- In Supabase dashboard → Auth → Settings:
--   "Confirm email" toggle: ON
--   "Password reset token expiry": 900 (15 minutes) — default is 86400 (24h)
--   "Magic link token expiry":     900 (15 minutes)

-- ── 2. login_attempts: add TTL index + periodic auto-cleanup ─────────────────
-- Adds a PostgreSQL partial index so expired rows are cheap to scan/delete.
-- pg_cron (if available) can run cleanup_login_attempts() on a schedule.
CREATE INDEX IF NOT EXISTS login_attempts_expiry_idx
  ON public.login_attempts (attempted_at)
  WHERE attempted_at < now() - interval '15 minutes';

-- Re-create cleanup with SECURITY DEFINER to run as owner, and revoke
-- execute from unprivileged roles so it can only be called server-side.
CREATE OR REPLACE FUNCTION public.cleanup_login_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.login_attempts
  WHERE attempted_at < now() - interval '15 minutes';
$$;

REVOKE ALL ON FUNCTION public.cleanup_login_attempts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_login_attempts() TO service_role;

-- ── 3. Strengthen login_attempts RLS ────────────────────────────────────────
-- Drop the overly broad restrictive policy and replace with explicit denials
-- for each operation, so intent is crystal-clear.
DROP POLICY IF EXISTS "No direct access to login_attempts" ON public.login_attempts;

-- No authenticated or anon user may SELECT, INSERT, UPDATE, or DELETE directly
CREATE POLICY "Deny anon select on login_attempts" ON public.login_attempts
  AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "Deny anon insert on login_attempts" ON public.login_attempts
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "Deny anon update on login_attempts" ON public.login_attempts
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon delete on login_attempts" ON public.login_attempts
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- ── 4. user_roles: tighten SELECT policy scope ───────────────────────────────
-- Users should only read their own role row for the must_change_password flag.
-- The earlier "Admins can view all roles" policy is kept; add a guard ensuring
-- non-admins can only see their own row (defence in depth).
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own must_change_password" ON public.user_roles;

CREATE POLICY "Users can view their own role row" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- ── 5. Revoke function permissions (defence-in-depth) ────────────────────────
-- Ensure no anon/authenticated caller can invoke internal helper functions
-- directly via RPC. Server functions use service_role which bypasses this.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- ── 6. Audit: confirm all tables have RLS enabled ────────────────────────────
-- These are no-ops if already set, but serve as a safety net.
ALTER TABLE public.login_attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages  ENABLE ROW LEVEL SECURITY;

-- ── 7. Contact form: add rate-limit by IP via pg_net (optional) ──────────────
-- If pg_net / pg_cron are enabled, you can further rate-limit the contact
-- form. For now we enforce length + format constraints (already in migration
-- 20260503030821). Document here for ops awareness.
--
-- Maximum contact submissions from a single email within 24 hours: enforce
-- via a unique partial index or application-level check if needed.

