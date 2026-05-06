/**
 * Reusable TanStack Start middleware for abuse protection.
 *
 * Composes rate limiting + bot detection into a single middleware that can be
 * applied to any server function with `.middleware([...])`.
 *
 * TIERS
 * ─────
 *   requireGeneralApiLimit    — 60 req/min per IP
 *   requireContactFormLimit   — 3 req/hour per IP (honeypot + timing checked in handler)
 *   requireAccountCreateLimit — 2 req/day per IP, strict bot detection
 *   requireAiLimit            — payment-level: strict bot + per-user 10/hr + per-IP 20/hr
 */

import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit, extractIp, rateLimitHeaders, type RateLimitPolicy } from "@/lib/rate-limiter";
import { scoreRequest, shouldBlock, isSuspicious, abuseResponse, BotRisk } from "@/lib/bot-detection";
import { log } from "@/lib/logger";

// ── Shared context shape added by all abuse-protection middleware ──────────────
export interface AbuseContext {
  ip: string;
  botScore: { score: number; risk: BotRisk; signals: string[] };
  rateLimit?: {
    allowed: boolean;
    remaining?: number;
    retryAfterSeconds?: number;
    limit: number;
    windowSeconds: number;
    headers: Record<string, string>;
  };
}

// ── Internal factory ──────────────────────────────────────────────────────────

function makeAbuseMiddleware(
  policy: RateLimitPolicy,
  keyFn: (request: Request, context: Record<string, unknown>) => string | null,
  strict = false,
) {
  return createMiddleware({ type: "function" }).server(async ({ next, context }) => {
    const request = getRequest();
    const ip = extractIp(request);
    const ctx = (context ?? {}) as Record<string, unknown>;
    const botScore = scoreRequest(request);

    // Block definitive bots immediately
    if (shouldBlock(botScore)) {
      log.suspiciousActivity("bot_blocked", {
        ip,
        detail: `score=${botScore.score} policy=${policy}`,
      });
      throw abuseResponse("block");
    }

    // Strict mode: also block LikelyBot (score 60–79)
    if (strict && botScore.risk === BotRisk.LikelyBot) {
      log.suspiciousActivity("bot_blocked", {
        ip,
        detail: `likely_bot strict score=${botScore.score} policy=${policy}`,
      });
      throw abuseResponse("block");
    }

    const rawKey = keyFn(request, ctx);
    const abuseCtx: AbuseContext = { ip, botScore };

    if (rawKey !== null) {
      // Suspicious requests use a namespaced key so they exhaust their own
      // sub-quota without consuming clean traffic's allowance.
      const effectiveKey = isSuspicious(botScore) ? `sus:${rawKey}` : rawKey;
      const result = await checkRateLimit(supabaseAdmin, policy, effectiveKey, ip);

      if (!result.allowed) {
        log.suspiciousActivity("rate_limit_exceeded", {
          ip,
          detail: `policy=${policy} retryAfter=${result.retryAfterSeconds}s`,
        });
        throw abuseResponse("rate_limit", result.retryAfterSeconds);
      }

      abuseCtx.rateLimit = { ...result, headers: rateLimitHeaders(result) };
    }

    return next({ context: { ...ctx, ...abuseCtx } });
  });
}

// ── Public middleware exports ──────────────────────────────────────────────────

/** 60 req/min per IP — use on general server functions. */
export const requireGeneralApiLimit = makeAbuseMiddleware(
  "api_general",
  (req) => extractIp(req),
  false,
);

/** 3 req/hour per IP — contact form spam protection. */
export const requireContactFormLimit = makeAbuseMiddleware(
  "contact",
  (req) => extractIp(req),
  false,
);

/** 2 req/day per IP — account provisioning, strict bot detection. */
export const requireAccountCreateLimit = makeAbuseMiddleware(
  "account_create",
  (req) => extractIp(req),
  true,
);

/**
 * AI generation — payment-level protection.
 *
 * Applies in order:
 *   1. Strict bot detection: LikelyBot (≥60) is blocked outright.
 *   2. Per-user limit:  10 req/hour  (requires requireSupabaseAuth before this).
 *   3. Per-IP limit:    20 req/hour  (defence-in-depth).
 *
 * Usage: .middleware([requireSupabaseAuth, requireAiLimit])
 */
export const requireAiLimit = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const request = getRequest();
    const ip = extractIp(request);
    const ctx = (context ?? {}) as Record<string, unknown>;

    // Strict bot detection — payment level
    const botScore = scoreRequest(request);
    if (botScore.risk === BotRisk.Block || botScore.risk === BotRisk.LikelyBot) {
      log.suspiciousActivity("bot_blocked", {
        ip,
        detail: `ai endpoint score=${botScore.score} risk=${botScore.risk}`,
      });
      throw abuseResponse("block");
    }

    // Per-user limit
    const userId = ctx.userId as string | undefined;
    if (userId) {
      const userResult = await checkRateLimit(supabaseAdmin, "ai_generate", userId, ip);
      if (!userResult.allowed) {
        log.suspiciousActivity("rate_limit_exceeded", {
          ip,
          detail: `ai per-user userId=${userId.slice(0, 8)} retryAfter=${userResult.retryAfterSeconds}s`,
        });
        throw abuseResponse("rate_limit", userResult.retryAfterSeconds);
      }
    }

    // Per-IP limit (catches unauthenticated abuse too)
    const ipResult = await checkRateLimit(supabaseAdmin, "ai_generate_ip", ip, ip);
    if (!ipResult.allowed) {
      log.suspiciousActivity("rate_limit_exceeded", {
        ip,
        detail: `ai per-ip retryAfter=${ipResult.retryAfterSeconds}s`,
      });
      throw abuseResponse("rate_limit", ipResult.retryAfterSeconds);
    }

    const abuseCtx: AbuseContext = {
      ip,
      botScore,
      rateLimit: { ...ipResult, headers: rateLimitHeaders(ipResult) },
    };

    return next({ context: { ...ctx, ...abuseCtx } });
  },
);
