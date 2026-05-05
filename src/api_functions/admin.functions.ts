import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { log } from "@/lib/logger";
import { validateServerEnv } from "@/lib/env";

// ── Startup validation ────────────────────────────────────────────────────────
// Fail fast if required secrets are absent rather than propagating undefined.
validateServerEnv();

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

// ── Input validators (Zod) ────────────────────────────────────────────────────
// Using .validator() tells TanStack Start the input shape, which fixes the
// ServerFnCtx<..., TInputValidator> data type and enables proper TS inference.
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

/** First 8 hex chars of the hash — enough for log correlation without exposing identity. */
function identifierHint(identifier: string): string {
  return hashIdentifier(identifier).slice(0, 8);
}

/**
 * Constant-time XOR comparison for fixed-length SHA-256 hex strings.
 * Cannot import timingSafeEqual at top-level — Vite externalises Node built-ins
 * during the client bundle pass.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
void safeCompare; // suppress unused-var

// login_attempts and must_change_password exist in the DB but are absent from
// the auto-generated types.ts (Supabase CLI hasn't re-introspected the latest
// security migrations). Cast to `any` until `supabase gen types` is re-run.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

// ── Server functions ──────────────────────────────────────────────────────────

/** Returns a boolean: is at least one admin account provisioned? */
export const getAdminReady = createServerFn({ method: "GET" }).handler(async () => {
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
 * Server-side rate-limit check — call BEFORE supabase.auth.signInWithPassword.
 * Identifiers are hashed (SHA-256 + domain prefix); plaintext is never stored.
 */
export const checkLoginRateLimit = createServerFn({ method: "POST" })
  .inputValidator(identifierSchema)
  .handler(async ({ data }) => {
    const trimmed = data.identifier.trim();

    try {
      const hashed = hashIdentifier(trimmed);
      const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

      // Prune expired rows before counting (keeps the table lean)
      await db.from("login_attempts").delete().lt("attempted_at", windowStart);

      const { count } = await db
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("identifier", hashed)
        .gte("attempted_at", windowStart);

      if ((count ?? 0) >= MAX_ATTEMPTS) {
        const { data: oldest } = await db
          .from("login_attempts")
          .select("attempted_at")
          .eq("identifier", hashed)
          .gte("attempted_at", windowStart)
          .order("attempted_at", { ascending: true })
          .limit(1);

        const lockLiftAt = oldest?.[0]?.attempted_at
          ? new Date(oldest[0].attempted_at).getTime() + WINDOW_MINUTES * 60 * 1000
          : Date.now() + WINDOW_MINUTES * 60 * 1000;

        const retryAfterSeconds = Math.ceil((lockLiftAt - Date.now()) / 1000);

        log.suspiciousActivity("rate_limit_exceeded", {
          detail: `login blocked identifierHint=${identifierHint(trimmed)}`,
          count: count ?? MAX_ATTEMPTS,
        });
        log.authAttempt("login_locked", { identifierHint: identifierHint(trimmed) });
        return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 0) };
      }

      return { allowed: true, retryAfterSeconds: undefined };
    } catch (err) {
      log.apiError("checkLoginRateLimit", err);
      // Fail open — a server error must not block legitimate logins.
      return { allowed: true, retryAfterSeconds: undefined };
    }
  });

/**
 * Records a failed login attempt.
 * Call AFTER a failed signInWithPassword. Identifier is hashed before storage.
 */
export const recordFailedLogin = createServerFn({ method: "POST" })
  .inputValidator(identifierSchema)
  .handler(async ({ data }) => {
    const trimmed = data.identifier.trim();
    try {
      await db.from("login_attempts").insert({ identifier: hashIdentifier(trimmed) });
      log.authAttempt("login_failed", { identifierHint: identifierHint(trimmed) });
      return { ok: true };
    } catch (err) {
      log.apiError("recordFailedLogin", err);
      return { ok: false };
    }
  });

/**
 * Server-side password policy enforcement + update.
 * Policy is validated HERE (server) — cannot be bypassed by crafted API calls.
 * Supabase stores only a bcrypt hash; plaintext is never logged or persisted.
 */
export const validateAndUpdatePassword = createServerFn({ method: "POST" })
  .inputValidator(passwordSchema)
  .middleware([requireSupabaseAuth])
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

/**
 * Clears the must_change_password flag after a successful password update.
 */
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
