import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireGeneralApiLimit } from "@/middleware/abuse-protection";
import { checkRateLimit, extractIp } from "@/lib/rate-limiter";
import { scoreRequest, shouldBlock, abuseResponse, BotRisk } from "@/lib/bot-detection";
import { log } from "@/lib/logger";
import { validateServerEnv } from "@/lib/env";
import { getRequest } from "@tanstack/react-start/server";

validateServerEnv();

// ── Constants ─────────────────────────────────────────────────────────────────
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

// ── Input schemas ─────────────────────────────────────────────────────────────
const identifierSchema = z.object({
  identifier: z.string().min(1).max(320),
});

const passwordSchema = z.object({
  password: z.string().min(1).max(1024),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashIdentifier(identifier: string): string {
  return createHash("sha256")
    .update("cognivus-login-attempt:")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

function identifierHint(identifier: string): string {
  return hashIdentifier(identifier).slice(0, 8);
}

// safeCompare — constant-time XOR for fixed-length hex digests.
// timingSafeEqual cannot be imported top-level (Vite client-bundle pass).
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
void safeCompare;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

// ── Server functions ──────────────────────────────────────────────────────────

/** Returns whether at least one admin account is provisioned. */
export const getAdminReady = createServerFn({ method: "GET" })
  .middleware([requireGeneralApiLimit])
  .handler(async () => {
    try {
      const { data: roles, error } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("role", "admin")
        .limit(1);

      if (error) {
        log.apiError("getAdminReady", error);
        return { ready: false };
      }
      return { ready: (roles?.length ?? 0) > 0 };
    } catch (err) {
      log.apiError("getAdminReady", err);
      return { ready: false };
    }
  });

/**
 * Server-side rate-limit check for login attempts.
 *
 * Uses the new `rate_limit_buckets` table (sliding window) instead of the
 * old `login_attempts` table. The login policy is 5 attempts / 15 minutes.
 * Also runs bot detection — automated login scripts are blocked outright.
 */
export const checkLoginRateLimit = createServerFn({ method: "POST" })
  .inputValidator(identifierSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const ip = extractIp(request);

    // Bot detection on login endpoint
    const botScore = scoreRequest(request);
    if (shouldBlock(botScore)) {
      log.suspiciousActivity("rapid_requests", {
        ip,
        detail: `login bot blocked score=${botScore.score}`,
      });
      return { allowed: false, retryAfterSeconds: 900 };
    }

    const trimmed = data.identifier.trim();

    // Delegate to the unified rate limiter (login policy: 5/15min)
    const result = await checkRateLimit(supabaseAdmin, "login", trimmed, ip);

    if (!result.allowed) {
      log.suspiciousActivity("rate_limit_exceeded", {
        ip,
        detail: `login blocked identifierHint=${identifierHint(trimmed)}`,
        count: result.limit,
      });
      log.authAttempt("login_locked", { identifierHint: identifierHint(trimmed), ip });
    }

    return {
      allowed: result.allowed,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  });

/**
 * Records a failed login attempt.
 * With the new rate limiter, recording is done in checkLoginRateLimit itself
 * (each call inserts a row). This function now just logs the failure event.
 */
export const recordFailedLogin = createServerFn({ method: "POST" })
  .inputValidator(identifierSchema)
  .handler(async ({ data }) => {
    const trimmed = data.identifier.trim();
    try {
      log.authAttempt("login_failed", { identifierHint: identifierHint(trimmed) });
      return { ok: true };
    } catch (err) {
      log.apiError("recordFailedLogin", err);
      return { ok: false };
    }
  });

/**
 * Server-side password policy enforcement.
 * Requires auth + general API rate limiting.
 */
export const validateAndUpdatePassword = createServerFn({ method: "POST" })
  .inputValidator(passwordSchema)
  .middleware([requireSupabaseAuth, requireGeneralApiLimit])
  .handler(async ({ data, context }) => {
    const { password } = data;
    const userId = (context as { userId: string }).userId;

    if (password.length < PASSWORD_MIN_LENGTH) {
      log.authAttempt("password_change_failed", { userId, identifierHint: "policy_length" });
      return { ok: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
    }

    if (!PASSWORD_POLICY.test(password)) {
      log.authAttempt("password_change_failed", { userId, identifierHint: "policy_complexity" });
      return {
        ok: false,
        error: "Password must include uppercase, lowercase, a digit, and a special character.",
      };
    }

    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) {
        log.apiError("validateAndUpdatePassword", error, { statusCode: 500 });
        log.authAttempt("password_change_failed", { userId });
        return { ok: false, error: "Password update failed. Please try again." };
      }
      log.authAttempt("password_changed", { userId });
      return { ok: true, error: undefined };
    } catch (err) {
      log.apiError("validateAndUpdatePassword", err, { statusCode: 500 });
      return { ok: false, error: "An unexpected error occurred." };
    }
  });

/** Clears the must_change_password flag. */
export const clearMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId: string }).userId;
    try {
      const { error } = await db
        .from("user_roles")
        .update({ must_change_password: false })
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) {
        log.apiError("clearMustChangePassword", error);
      } else {
        log.info("must_change_password_cleared", { userId });
      }
    } catch (err) {
      log.apiError("clearMustChangePassword", err);
    }
    return { ok: true };
  });
