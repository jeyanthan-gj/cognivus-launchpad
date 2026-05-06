-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: abuse protection infrastructure
-- Covers:
--   1. rate_limit_buckets  — sliding-window rate limiting (replaces login_attempts)
--   2. Indexes for fast window-range queries and automatic TTL expiry
--   3. RLS — no direct access from anon/authenticated; service_role only
--   4. cleanup function + pg_cron schedule (uncomment if pg_cron is enabled)
--   5. contact_messages hardening — stricter constraints
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. rate_limit_buckets ─────────────────────────────────────────────────────
-- Each row represents a single request hit within a sliding window.
-- Rows are deleted when they fall outside their window (TTL pruned in app).
-- The `key` column stores a SHA-256 hex digest — never plaintext IP or email.
-- The `policy` column maps to the POLICIES constant in src/lib/rate-limiter.ts.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  id         bigserial   PRIMARY KEY,
  key        text        NOT NULL,  -- SHA-256(namespace:identifier)
  policy     text        NOT NULL   CHECK (policy IN (
                           'login',
                           'contact',
                           'api_general',
                           'account_create',
                           'ai_generate',
                           'ai_generate_ip'
                         )),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rate_limit_buckets IS
  'Sliding-window rate limit hits. Each row = 1 request. Pruned by the app on each check. '
  'key is SHA-256(policy:identifier) — no plaintext IP or email stored.';

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

-- Primary lookup: (key, created_at) — used in every rate-limit check
CREATE INDEX IF NOT EXISTS rl_buckets_key_ts_idx
  ON public.rate_limit_buckets (key, created_at DESC);

-- Cleanup index: find all rows older than any window (max window = 24h for account_create)
CREATE INDEX IF NOT EXISTS rl_buckets_cleanup_idx
  ON public.rate_limit_buckets (created_at)
  WHERE created_at < now() - interval '24 hours';

-- Per-policy cleanup: useful for targeted pruning
CREATE INDEX IF NOT EXISTS rl_buckets_policy_ts_idx
  ON public.rate_limit_buckets (policy, created_at DESC);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Blanket deny for all non-service roles — only the server (service_role) may
-- read or write rate limit data. Prevents anon from reading or manipulating limits.
CREATE POLICY "Deny anon/auth select on rate_limit_buckets"
  ON public.rate_limit_buckets AS RESTRICTIVE FOR SELECT
  TO anon, authenticated USING (false);

CREATE POLICY "Deny anon/auth insert on rate_limit_buckets"
  ON public.rate_limit_buckets AS RESTRICTIVE FOR INSERT
  TO anon, authenticated WITH CHECK (false);

CREATE POLICY "Deny anon/auth update on rate_limit_buckets"
  ON public.rate_limit_buckets AS RESTRICTIVE FOR UPDATE
  TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon/auth delete on rate_limit_buckets"
  ON public.rate_limit_buckets AS RESTRICTIVE FOR DELETE
  TO anon, authenticated USING (false);

-- ── 4. Cleanup functions ──────────────────────────────────────────────────────

-- Generic cleanup: remove all expired rows across all policies.
-- Window durations mirror the POLICIES constant in rate-limiter.ts:
--   login           15 min
--   contact          1 hour
--   api_general      1 min
--   account_create  24 hours
--   ai_generate      1 hour
--   ai_generate_ip   1 hour
-- We use the maximum window (24h) as the outer bound — rows older than 24h
-- are expired under every possible policy.
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_buckets()
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  DELETE FROM public.rate_limit_buckets
  WHERE created_at < now() - interval '24 hours';
$$;

-- Fine-grained cleanup per policy (called inline by the app after each check)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_policy(p_policy text, p_window_seconds int)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  DELETE FROM public.rate_limit_buckets
  WHERE policy = p_policy
    AND created_at < now() - make_interval(secs => p_window_seconds);
$$;

-- Lock down execution — only service_role may call these
REVOKE ALL ON FUNCTION public.cleanup_rate_limit_buckets()                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_rate_limit_policy(text, int)            FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_rate_limit_buckets()                TO service_role;
GRANT  EXECUTE ON FUNCTION public.cleanup_rate_limit_policy(text, int)        TO service_role;

-- pg_cron schedule (uncomment if pg_cron extension is enabled in your project):
-- Runs every minute to prune api_general rows (1-min window).
-- Runs every 15 min to prune login rows (15-min window).
-- Runs hourly for all other policies.
--
-- SELECT cron.schedule('rl-cleanup-api-general',  '* * * * *',      $$ SELECT public.cleanup_rate_limit_policy('api_general',  60);    $$);
-- SELECT cron.schedule('rl-cleanup-login',        '*/15 * * * *',   $$ SELECT public.cleanup_rate_limit_policy('login',        900);   $$);
-- SELECT cron.schedule('rl-cleanup-contact',      '0 * * * *',      $$ SELECT public.cleanup_rate_limit_policy('contact',      3600);  $$);
-- SELECT cron.schedule('rl-cleanup-ai',           '0 * * * *',      $$ SELECT public.cleanup_rate_limit_policy('ai_generate',  3600);  $$);
-- SELECT cron.schedule('rl-cleanup-ai-ip',        '0 * * * *',      $$ SELECT public.cleanup_rate_limit_policy('ai_generate_ip', 3600); $$);
-- SELECT cron.schedule('rl-cleanup-account',      '0 0 * * *',      $$ SELECT public.cleanup_rate_limit_policy('account_create', 86400); $$);

-- ── 5. contact_messages hardening ────────────────────────────────────────────
-- The contact form is now submitted via a server function (submitContact) which
-- enforces rate limiting and bot detection. Add DB-level constraints as a
-- last line of defence in case the application layer is somehow bypassed.

-- Minimum message length (mirrors server-side Zod schema)
ALTER TABLE public.contact_messages
  ADD CONSTRAINT IF NOT EXISTS contact_message_min_length
    CHECK (char_length(trim(message)) >= 10);

-- Maximum lengths (defence-in-depth against oversized payload storage)
ALTER TABLE public.contact_messages
  ADD CONSTRAINT IF NOT EXISTS contact_name_max_length
    CHECK (char_length(name) <= 200);

ALTER TABLE public.contact_messages
  ADD CONSTRAINT IF NOT EXISTS contact_email_max_length
    CHECK (char_length(email) <= 320);

ALTER TABLE public.contact_messages
  ADD CONSTRAINT IF NOT EXISTS contact_message_max_length
    CHECK (char_length(message) <= 5000);

-- Basic email format check at DB level (belt-and-suspenders)
ALTER TABLE public.contact_messages
  ADD CONSTRAINT IF NOT EXISTS contact_email_format
    CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- ── 6. login_attempts table — deprecation notice ─────────────────────────────
-- The login_attempts table is superseded by rate_limit_buckets (which handles
-- all rate-limit policies uniformly). It is retained for now to avoid a
-- destructive migration, but the application no longer writes to it.
-- Once the migration is confirmed stable, run:
--   DROP TABLE IF EXISTS public.login_attempts;
COMMENT ON TABLE public.login_attempts IS
  '[DEPRECATED] Superseded by rate_limit_buckets. Safe to drop after verifying '
  'the new rate limiter is stable in production. The app no longer reads or writes this table.';

