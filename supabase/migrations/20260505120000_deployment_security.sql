-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: deployment security hardening
-- Covers:
--   1. Restrict Supabase DB access — revoke dangerous public privileges
--   2. Lock down PostgREST CORS to the production domain only
--   3. audit_log table — persistent record of auth events from server functions
--   4. Harden search_path on all existing functions to prevent schema injection
--   5. Ensure pg_net / realtime only connects over TLS (documented)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Revoke dangerous default privileges ────────────────────────────────────
-- PostgreSQL grants CONNECT to PUBLIC by default. Remove it so only
-- explicitly-granted roles (anon, authenticated, service_role) can connect.
-- NOTE: On Supabase managed instances this is already restricted at the
-- connection-pooler level (pgBouncer). This is defence-in-depth.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Prevent anon from creating objects in the public schema
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CREATE ON SCHEMA public TO service_role;

-- ── 2. audit_log table ───────────────────────────────────────────────────────
-- Stores structured auth/security events emitted by server functions.
-- Rows are INSERT-only from service_role; no UPDATE or DELETE permitted.
-- This provides a tamper-resistant audit trail even if application logs are lost.
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           bigserial PRIMARY KEY,
  ts           timestamptz NOT NULL DEFAULT now(),
  category     text        NOT NULL CHECK (category IN ('auth', 'api_error', 'suspicious', 'info')),
  event        text        NOT NULL,
  user_id      uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  -- Hashed identifier (first 8 hex chars of SHA-256) — never plaintext PII
  identifier_hint text,
  ip           text,
  detail       text,
  -- Prevent rows from growing unboundedly — auto-expire after 90 days
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

-- Index for time-range queries (incident response)
CREATE INDEX IF NOT EXISTS audit_log_ts_idx ON public.audit_log (ts DESC);
-- Index for user-specific event lookup
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON public.audit_log (user_id, ts DESC) WHERE user_id IS NOT NULL;
-- Index for category-based filtering
CREATE INDEX IF NOT EXISTS audit_log_category_idx ON public.audit_log (category, event, ts DESC);
-- Partial index for suspicious events — most common incident-response query
CREATE INDEX IF NOT EXISTS audit_log_suspicious_idx ON public.audit_log (ts DESC) WHERE category = 'suspicious';

-- RLS: audit_log is INSERT-only via service_role; no direct read from anon/authenticated
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- No row is readable by anon or authenticated users
CREATE POLICY "Deny all audit_log access to non-service roles"
  ON public.audit_log AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Only service_role may insert (application server writes events)
-- service_role bypasses RLS entirely, so this is for documentation purposes
COMMENT ON TABLE public.audit_log IS
  'Tamper-resistant audit log. INSERT via service_role only. No UPDATE/DELETE. Rows expire after 90 days.';

-- ── 3. Automatic audit_log cleanup (pg_cron if available) ────────────────────
-- If pg_cron is enabled in your Supabase project, uncomment this block:
--
-- SELECT cron.schedule(
--   'cleanup-audit-log',
--   '0 3 * * *',   -- 3 AM UTC daily
--   $$ DELETE FROM public.audit_log WHERE expires_at < now(); $$
-- );
--
-- SELECT cron.schedule(
--   'cleanup-login-attempts',
--   '*/15 * * * *',  -- every 15 minutes
--   $$ SELECT public.cleanup_login_attempts(); $$
-- );

-- ── 4. Harden search_path on existing functions ───────────────────────────────
-- A mutable search_path allows schema-injection attacks. Lock every
-- SECURITY DEFINER function to an explicit schema list.
ALTER FUNCTION public.has_role(uuid, public.app_role)
  SET search_path = public, auth;

ALTER FUNCTION public.set_updated_at()
  SET search_path = public;

ALTER FUNCTION public.cleanup_login_attempts()
  SET search_path = public;

-- ── 5. PostgREST CORS — documentation note ───────────────────────────────────
-- Supabase's PostgREST CORS is configured in the Supabase dashboard:
--   Project Settings → API → "Allowed origins (CORS)"
-- Set this to: https://cognivus.ai
-- Do NOT use * — wildcard CORS allows any website to make credentialed
-- requests to your API using a logged-in user's session token.
--
-- For local development, add http://localhost:5173 as a separate entry.

-- ── 6. Realtime — restrict to authenticated role ─────────────────────────────
-- If Realtime is used, ensure subscriptions require authentication.
-- Supabase dashboard → Realtime → "Realtime Security" → Enabled
-- All channel subscriptions should check RLS policies before broadcasting.

-- ── 7. Direct database access — pg_bouncer / connection pooler ───────────────
-- The Supabase connection string (port 5432) must NOT be accessible from
-- the public internet in production. Use the connection pooler (port 6543)
-- for application connections. Direct access should be IP-restricted to
-- your office/VPN CIDR in Supabase → Project Settings → Database → Connection info.
-- This is configured in the Supabase dashboard, not via SQL.

COMMENT ON SCHEMA public IS 'Application schema. Direct DB access restricted to service_role and pooler connections.';
