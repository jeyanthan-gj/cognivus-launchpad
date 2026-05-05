import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'
import { log } from '@/lib/logger'

// ── Token validation constants ────────────────────────────────────────────────
// JWTs are typically 300–1000 chars. Reject anything outside sane bounds to
// prevent log-flooding and CPU exhaustion from oversized payloads.
const TOKEN_MIN_LEN = 20;
const TOKEN_MAX_LEN = 2048;

// ── CORS — allowed origins for server function requests ───────────────────────
// Server functions (/_server/*) should only be called from the same origin.
// This is a defence-in-depth check — Netlify headers also enforce this at edge.
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? "https://cognivus.ai")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

function getRequestIp(request: Request): string {
  // Netlify sets CF-Connecting-IP or X-Forwarded-For
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    // SECURITY: anon/publishable key for token verification only — never the
    // service-role key here. Service-role key is exclusively in client.server.ts.
    const SUPABASE_PUBLISHABLE_KEY =
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      log.suspiciousActivity("missing_env_var", {
        detail: "auth-middleware: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY not set",
      });
      throw new Response('Internal server error', { status: 500 });
    }

    const request = getRequest();

    if (!request?.headers) {
      log.authAttempt("session_missing", { detail: "no request headers" } as never);
      throw new Response('Unauthorized', { status: 401 });
    }

    const ip = getRequestIp(request);

    // ── Origin check (CORS defence-in-depth) ─────────────────────────────────
    // In production only — skip in development where origin may be localhost.
    if (process.env.NODE_ENV === "production") {
      const origin = request.headers.get("origin");
      if (origin && !ALLOWED_ORIGINS.has(origin)) {
        log.suspiciousActivity("rapid_requests", {
          ip,
          detail: `rejected cross-origin server function call from: ${origin}`,
        });
        throw new Response('Forbidden', { status: 403 });
      }
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      log.authAttempt("session_missing", { ip } as never);
      throw new Response('Unauthorized', { status: 401 });
    }

    if (!authHeader.startsWith('Bearer ')) {
      log.suspiciousActivity("malformed_token", { ip, detail: "missing Bearer prefix" });
      throw new Response('Unauthorized', { status: 401 });
    }

    const token = authHeader.slice(7);

    // ── Token size guard ─────────────────────────────────────────────────────
    if (!token || token.length < TOKEN_MIN_LEN || token.length > TOKEN_MAX_LEN) {
      log.suspiciousActivity("oversized_token", {
        ip,
        detail: `token length ${token?.length ?? 0} outside [${TOKEN_MIN_LEN}, ${TOKEN_MAX_LEN}]`,
      });
      throw new Response('Unauthorized', { status: 401 });
    }

    // ── JWT structure check ──────────────────────────────────────────────────
    if (token.split('.').length !== 3) {
      log.suspiciousActivity("malformed_token", { ip, detail: "not a 3-part JWT" });
      throw new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    // Cryptographically verify the token via Supabase's JWKS endpoint.
    const { data, error } = await supabase.auth.getClaims(token);

    if (error || !data?.claims) {
      log.authAttempt("token_invalid", { ip } as never);
      throw new Response('Unauthorized', { status: 401 });
    }

    const { sub: userId, exp } = data.claims as { sub?: string; exp?: number };

    if (!userId) {
      log.authAttempt("token_invalid", { ip, detail: "no sub claim" } as never);
      throw new Response('Unauthorized', { status: 401 });
    }

    // Double-check expiry in case SDK leniency changes between versions
    if (!exp || exp * 1000 < Date.now()) {
      log.authAttempt("token_expired", { ip, userId } as never);
      throw new Response('Unauthorized', { status: 401 });
    }

    log.debug("token_verified", { userId: userId.slice(0, 8) + "..." });

    return next({ context: { supabase, userId, claims: data.claims } });
  }
);
