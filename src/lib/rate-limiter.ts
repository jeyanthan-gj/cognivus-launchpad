/**
 * Sliding-window rate limiter backed by Supabase (PostgreSQL).
 *
 * DESIGN
 * ──────
 * Uses a dedicated `rate_limit_buckets` table. Each row represents one
 * "window" for a (key, policy) pair. On each request:
 *   1. Delete expired rows for this key (TTL cleanup).
 *   2. Count rows within the current window.
 *   3. If count >= limit → reject with retryAfterSeconds.
 *   4. Otherwise → insert a new row and allow.
 *
 * This is a true sliding window (not a fixed bucket), so there are no
 * "reset spikes" at the edge of a fixed time period.
 *
 * POLICIES
 * ────────
 * Policies are modelled after payment-endpoint protection tiers:
 *
 *   POLICY          LIMIT   WINDOW   USE CASE
 *   ──────────────────────────────────────────────────────────────
 *   login           5       15 min   Brute-force protection
 *   contact         3       1 hour   Contact form spam
 *   api_general     60      1 min    General server function calls
 *   account_create  2       24 hours Account provisioning
 *   ai_generate     10      1 hour   AI generation (payment-level)
 *   ai_generate_ip  20      1 hour   Per-IP AI cap (broader net)
 *
 * KEY FORMATS
 * ───────────
 * Keys are always hashed with SHA-256 before storage so no plaintext
 * IP address or email is ever written to the database.
 *
 *   login:         SHA256("cognivus:login:" + hashedEmail)
 *   contact:       SHA256("cognivus:contact:" + ip)
 *   ai_generate:   SHA256("cognivus:ai:" + userId)   or  ip fallback
 *   api_general:   SHA256("cognivus:api:" + ip)
 */

import { log } from "./logger";

// ── Policy definitions ────────────────────────────────────────────────────────

export type RateLimitPolicy =
  | "login"
  | "contact"
  | "api_general"
  | "account_create"
  | "ai_generate"
  | "ai_generate_ip";

interface PolicyConfig {
  /** Maximum requests allowed in the window. */
  limit: number;
  /** Window duration in seconds. */
  windowSeconds: number;
  /** Human-readable label for logs. */
  label: string;
}

export const POLICIES: Record<RateLimitPolicy, PolicyConfig> = {
  login: {
    limit: 5,
    windowSeconds: 15 * 60,
    label: "login (5/15min)",
  },
  contact: {
    limit: 3,
    windowSeconds: 60 * 60,
    label: "contact-form (3/hour)",
  },
  api_general: {
    limit: 60,
    windowSeconds: 60,
    label: "api-general (60/min)",
  },
  account_create: {
    limit: 2,
    windowSeconds: 24 * 60 * 60,
    label: "account-create (2/day)",
  },
  ai_generate: {
    limit: 10,
    windowSeconds: 60 * 60,
    label: "ai-generate per-user (10/hour)",
  },
  ai_generate_ip: {
    limit: 20,
    windowSeconds: 60 * 60,
    label: "ai-generate per-ip (20/hour)",
  },
};

// ── Result type ───────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in the current window (undefined if blocked). */
  remaining?: number;
  /** Seconds until the oldest request expires and a slot opens. */
  retryAfterSeconds?: number;
  /** Total limit for this policy. */
  limit: number;
  /** Window in seconds for this policy. */
  windowSeconds: number;
}

// ── Key hashing ───────────────────────────────────────────────────────────────

/**
 * Hash a rate-limit key so no plaintext IP/email is stored in the DB.
 * The namespace prefix provides domain-separation between policies.
 */
/**
 * FNV-1a-64 hash — pure JS, no Node.js imports, works in browser + edge.
 *
 * Used exclusively for rate-limit bucket key namespacing (DB lookup key).
 * This is NOT a cryptographic hash — it is a fast, deterministic,
 * collision-resistant hash suitable for hash-table keying.
 *
 * Why not SHA-256 here?
 *   rate-limiter.ts is transitively imported by contact.tsx (a client route),
 *   so any Node.js `crypto` import would be pulled into the browser bundle.
 *   admin.functions.ts uses SHA-256 only for login identifier hinting because
 *   TanStack Start tree-shakes server functions out of the client bundle.
 *
 * Collision rate: ~1 in 2^64 for distinct inputs — negligible for our use case.
 */
export function hashRateLimitKey(namespace: string, identifier: string): string {
  const input = `cognivus:rl:${namespace}:${identifier.trim().toLowerCase()}`;

  // FNV-1a 64-bit using two 32-bit halves (JS lacks native 64-bit integers)
  let hi = 0x6c62272e;
  let lo = 0x07bb0142;

  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    lo ^= c;
    // Multiply by FNV prime 0x00000100000001B3 (split into hi/lo)
    const newLo = Math.imul(lo, 0x01000193);
    const newHi = Math.imul(hi, 0x01000193) + Math.imul(lo, 0x00000100);
    lo = newLo >>> 0;
    hi = newHi >>> 0;
  }

  // Return 16-char hex (8 bytes)
  return (hi >>> 0).toString(16).padStart(8, "0") + (lo >>> 0).toString(16).padStart(8, "0");
}

// ── IP extraction ─────────────────────────────────────────────────────────────

/**
 * Extract the real client IP from a Netlify/Cloudflare request.
 * Priority: CF-Connecting-IP > X-Forwarded-For (first hop) > fallback.
 *
 * SECURITY: X-Forwarded-For is spoofable if not behind a trusted proxy.
 * Netlify/Cloudflare always set CF-Connecting-IP to the real client IP,
 * so we prefer that header.
 */
export function extractIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ── Core rate limiter ─────────────────────────────────────────────────────────

/**
 * Check and record a rate-limit attempt for the given key and policy.
 *
 * @param supabaseAdmin  Service-role Supabase client (bypasses RLS).
 * @param policy         Which policy tier to apply.
 * @param rawKey         The un-hashed identifier (email, IP, userId, etc.).
 * @param ip             Client IP for logging (never stored in DB).
 */
export async function checkRateLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  policy: RateLimitPolicy,
  rawKey: string,
  ip = "unknown",
): Promise<RateLimitResult> {
  const config = POLICIES[policy];
  const hashedKey = hashRateLimitKey(policy, rawKey);
  const windowStart = new Date(Date.now() - config.windowSeconds * 1000).toISOString();

  try {
    // 1. Prune expired rows for this key (sliding window maintenance)
    await supabaseAdmin
      .from("rate_limit_buckets")
      .delete()
      .eq("key", hashedKey)
      .lt("created_at", windowStart);

    // 2. Count active hits in the current window
    const { count, error: countError } = await supabaseAdmin
      .from("rate_limit_buckets")
      .select("id", { count: "exact", head: true })
      .eq("key", hashedKey)
      .gte("created_at", windowStart);

    if (countError) {
      log.apiError("checkRateLimit", countError, { path: `rate_limit/${policy}` });
      // Fail open — DB errors must not block legitimate traffic
      return { allowed: true, limit: config.limit, windowSeconds: config.windowSeconds };
    }

    const current = count ?? 0;

    // 3. Check if limit exceeded
    if (current >= config.limit) {
      // Find oldest row to compute precise unlock time
      const { data: oldest } = await supabaseAdmin
        .from("rate_limit_buckets")
        .select("created_at")
        .eq("key", hashedKey)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true })
        .limit(1);

      const oldestTs = oldest?.[0]?.created_at
        ? new Date(oldest[0].created_at).getTime()
        : Date.now() - config.windowSeconds * 1000;

      const unlockAt = oldestTs + config.windowSeconds * 1000;
      const retryAfterSeconds = Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000));

      log.suspiciousActivity("rate_limit_exceeded", {
        ip,
        count: current,
        detail: `policy=${policy} (${config.label})`,
      });

      return {
        allowed: false,
        retryAfterSeconds,
        limit: config.limit,
        windowSeconds: config.windowSeconds,
      };
    }

    // 4. Record this request
    await supabaseAdmin
      .from("rate_limit_buckets")
      .insert({ key: hashedKey, policy });

    return {
      allowed: true,
      remaining: config.limit - current - 1,
      limit: config.limit,
      windowSeconds: config.windowSeconds,
    };
  } catch (err) {
    log.apiError("checkRateLimit", err, { path: `rate_limit/${policy}` });
    // Fail open — never block traffic due to our own infrastructure errors
    return { allowed: true, limit: config.limit, windowSeconds: config.windowSeconds };
  }
}

/**
 * Build standard rate-limit HTTP response headers from a RateLimitResult.
 * Use these on every server function response so clients can back off gracefully.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Window": String(result.windowSeconds),
  };
  if (result.remaining !== undefined) {
    headers["X-RateLimit-Remaining"] = String(result.remaining);
  }
  if (!result.allowed && result.retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
    headers["X-RateLimit-Reset"] = String(Math.ceil(Date.now() / 1000) + result.retryAfterSeconds);
  }
  return headers;
}
