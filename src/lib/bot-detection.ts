/**
 * Server-side bot and abuse detection for Cognivus.
 *
 * APPROACH
 * ────────
 * Scores each request from 0 (clean) to 100 (certain bot) using multiple
 * lightweight signals that don't require external services:
 *
 *   Signal                         Max score   Rationale
 *   ─────────────────────────────────────────────────────────────────────
 *   Missing User-Agent             40          All real browsers send UA
 *   Known-bad UA patterns          40          curl, python-requests, etc.
 *   Suspiciously short UA          20          Scrapers often use minimal UA
 *   Missing Accept header          15          All browsers send Accept
 *   Missing Accept-Language        10          Browsers always negotiate lang
 *   Fetch/XHR without sec-fetch    15          Direct API abuse
 *   Extremely high request rate    30          Captured from rate-limit count
 *
 * Scores are additive and capped at 100.
 *
 * THRESHOLDS
 * ──────────
 *   < 30   Clean — allow
 *   30–59  Suspicious — allow but log
 *   60–79  Likely bot — rate limit aggressively
 *   ≥ 80   Certain bot — block
 *
 * USAGE
 * ─────
 *   import { scoreRequest, BotRisk } from "@/lib/bot-detection";
 *
 *   const { score, risk, signals } = scoreRequest(request);
 *   if (risk === BotRisk.Block) throw new Response("Forbidden", { status: 403 });
 */

import { log } from "./logger";

// ── Risk levels ───────────────────────────────────────────────────────────────

export enum BotRisk {
  /** Score < 30 — allow normally. */
  Clean = "clean",
  /** Score 30–59 — allow, log for monitoring. */
  Suspicious = "suspicious",
  /** Score 60–79 — apply aggressive rate limiting. */
  LikelyBot = "likely_bot",
  /** Score ≥ 80 — block outright. */
  Block = "block",
}

export interface BotScore {
  score: number;
  risk: BotRisk;
  /** Human-readable list of signals that contributed to the score. */
  signals: string[];
}

// ── Known-bad User-Agent patterns ─────────────────────────────────────────────
// These are tools/frameworks commonly used for automated scraping and abuse.
// Legitimate users never send these UA strings.

const BAD_UA_PATTERNS: RegExp[] = [
  /^python-requests\//i,
  /^python-urllib\//i,
  /^go-http-client\//i,
  /^ruby\//i,
  /^java\//i,
  /^php\//i,
  /^libwww-perl\//i,
  /^lwp-trivial\//i,
  /^curl\//i,
  /^wget\//i,
  /^scrapy\//i,
  /^mechanize\//i,
  /^httpclient\//i,
  /^axios\//i,           // scripts, not browsers
  /^node-fetch\//i,
  /^got\//i,
  /^undici\//i,
  /^okhttp\//i,
  /masscan/i,
  /nikto/i,
  /sqlmap/i,
  /nmap/i,
  /zgrab/i,
  /nuclei/i,
  /dirbuster/i,
  /hydra/i,
  /medusa/i,
];

// Browsers always include these substrings somewhere in their UA.
const BROWSER_UA_MARKERS = ["Mozilla/", "AppleWebKit", "Gecko", "Chrome", "Safari", "Firefox"];

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Score a server-side Request object for bot signals.
 * All checks are O(1) string operations — no async calls.
 */
export function scoreRequest(request: Request, extraRequestCount = 0): BotScore {
  const signals: string[] = [];
  let score = 0;

  const ua = request.headers.get("user-agent") ?? "";
  const accept = request.headers.get("accept") ?? "";
  const acceptLang = request.headers.get("accept-language") ?? "";
  const secFetchDest = request.headers.get("sec-fetch-dest") ?? "";
  const secFetchMode = request.headers.get("sec-fetch-mode") ?? "";

  // ── User-Agent checks ────────────────────────────────────────────────────
  if (!ua) {
    score += 40;
    signals.push("missing_user_agent");
  } else {
    // Known-bad UA pattern
    const badPattern = BAD_UA_PATTERNS.find((p) => p.test(ua));
    if (badPattern) {
      score += 40;
      signals.push(`known_bad_ua:${ua.slice(0, 40)}`);
    } else if (ua.length < 20) {
      // Suspiciously short — real browser UAs are long
      score += 20;
      signals.push(`short_ua:len=${ua.length}`);
    } else if (!BROWSER_UA_MARKERS.some((m) => ua.includes(m))) {
      // No browser markers in UA
      score += 15;
      signals.push("no_browser_markers_in_ua");
    }
  }

  // ── Accept header checks ─────────────────────────────────────────────────
  if (!accept) {
    score += 15;
    signals.push("missing_accept_header");
  }

  // ── Accept-Language — all browsers send this for user-facing pages ───────
  if (!acceptLang) {
    score += 10;
    signals.push("missing_accept_language");
  }

  // ── Sec-Fetch-* — Fetch Metadata — browsers send these on same-origin ───
  // A POST request without sec-fetch-mode is almost certainly programmatic.
  if (request.method === "POST" && !secFetchDest && !secFetchMode) {
    score += 15;
    signals.push("missing_sec_fetch_metadata");
  }

  // ── High request count from rate limiter ─────────────────────────────────
  // If the caller passes the current count, boost score if nearing a limit.
  if (extraRequestCount >= 10) {
    score += Math.min(30, extraRequestCount * 2);
    signals.push(`high_request_count:${extraRequestCount}`);
  }

  // Cap at 100
  score = Math.min(100, score);

  const risk =
    score >= 80 ? BotRisk.Block
    : score >= 60 ? BotRisk.LikelyBot
    : score >= 30 ? BotRisk.Suspicious
    : BotRisk.Clean;

  if (risk !== BotRisk.Clean) {
    log.suspiciousActivity("rapid_requests", {
      detail: `bot_score=${score} risk=${risk} signals=${signals.join(",")}`,
    });
  }

  return { score, risk, signals };
}

/**
 * Returns true if the request should be blocked outright.
 * Use this for payment-level endpoints (AI generation, account creation).
 */
export function shouldBlock(botScore: BotScore): boolean {
  return botScore.risk === BotRisk.Block;
}

/**
 * Returns true if the request is suspicious enough to warrant aggressive
 * rate limiting (half the normal limit).
 */
export function isSuspicious(botScore: BotScore): boolean {
  return botScore.risk === BotRisk.Suspicious || botScore.risk === BotRisk.LikelyBot;
}

/**
 * Build a standard abuse-protection response with appropriate status code.
 *
 *   Block     → 403 Forbidden  (no retry guidance — bots don't deserve it)
 *   Rate limit → 429 Too Many Requests + Retry-After header
 */
export function abuseResponse(type: "block" | "rate_limit", retryAfterSeconds?: number): Response {
  if (type === "block") {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("Too Many Requests", {
    status: 429,
    headers: {
      "Content-Type": "text/plain",
      "Retry-After": String(retryAfterSeconds ?? 60),
      "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + (retryAfterSeconds ?? 60)),
    },
  });
}
