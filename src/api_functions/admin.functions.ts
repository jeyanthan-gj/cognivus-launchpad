import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── Rate limiting constants ───────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

// ── Minimum password policy ───────────────────────────────────────────────────
// Enforced server-side so it cannot be bypassed by a crafted request.
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

/**
 * Hashes an identifier (email/IP) with a consistent salt so plaintext is
 * never stored in the DB. The salt is application-specific but not secret —
 * its purpose is domain-separation, not key-stretching.
 */
function hashIdentifier(identifier: string): string {
  return createHash("sha256")
    .update("cognivus-login-attempt:")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

/**
 * Constant-time string comparison — prevents timing-based enumeration of
 * stored hashed identifiers. Falls back to false on length mismatch without
 * leaking timing information.
 */
function safeCompare(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/**
 * Returns only a boolean indicating whether at least one admin user exists.
 * No emails, credentials, or PII are exposed to the client.
 *
 * Admin provisioning is done exclusively via the CLI script
 * (`scripts/provision-admin.ts`) or the Supabase dashboard.
 */
export const getAdminReady = createServerFn({ method: "GET" }).handler(async () => {
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("role", "admin")
    .limit(1);

  if (error) {
    // Return false without leaking internal error details to the client
    return { ready: false };
  }

  return { ready: (roles?.length ?? 0) > 0 };
});

/**
 * Server-side rate-limit check for login attempts.
 *
 * Call this BEFORE calling supabase.auth.signInWithPassword on the client.
 * Identifiers are hashed (SHA-256 + domain prefix) — plaintext is never stored.
 *
 * Returns { allowed: true } if the attempt is within limits, or
 * { allowed: false, retryAfterSeconds } if the account is locked.
 */
export const checkLoginRateLimit = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { identifier: string } }) => {
    // Validate input — reject missing or obviously invalid identifiers
    if (!data?.identifier || typeof data.identifier !== "string") {
      return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60 };
    }

    const trimmed = data.identifier.trim();
    if (trimmed.length === 0 || trimmed.length > 320) {
      return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60 };
    }

    const hashed = hashIdentifier(trimmed);
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    // Prune expired attempts before counting (keep table lean)
    await supabaseAdmin
      .from("login_attempts")
      .delete()
      .lt("attempted_at", windowStart);

    const { count } = await supabaseAdmin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", hashed)
      .gte("attempted_at", windowStart);

    if ((count ?? 0) >= MAX_ATTEMPTS) {
      // Find the oldest attempt in the window to compute precise unlock time
      const { data: oldest } = await supabaseAdmin
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
      return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 0) };
    }

    return { allowed: true };
  },
);

/**
 * Records a failed login attempt for the given identifier.
 * Call this AFTER a failed signInWithPassword.
 * The identifier is hashed before storage — never stored in plaintext.
 */
export const recordFailedLogin = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { identifier: string } }) => {
    if (!data?.identifier || typeof data.identifier !== "string") {
      return { ok: false };
    }

    const trimmed = data.identifier.trim();
    if (trimmed.length === 0 || trimmed.length > 320) {
      return { ok: false };
    }

    const hashed = hashIdentifier(trimmed);
    await supabaseAdmin.from("login_attempts").insert({ identifier: hashed });
    return { ok: true };
  },
);

/**
 * Server-side password policy enforcement.
 *
 * Validates the new password against our policy BEFORE forwarding to Supabase.
 * This prevents bypassing client-side validation via direct API calls.
 * Requires a valid Bearer token (auth middleware).
 *
 * SECURITY: The actual password update is performed by Supabase's auth layer
 * which stores only a bcrypt hash (cost factor 10+). Plain passwords are never
 * logged or stored.
 */
export const validateAndUpdatePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { password: string }; context: { userId: string } }) => {
    const { password } = data ?? {};

    // Validate input type
    if (!password || typeof password !== "string") {
      return { ok: false, error: "Invalid request." };
    }

    // Server-side policy check — cannot be bypassed via direct API calls
    if (password.length < PASSWORD_MIN_LENGTH) {
      return { ok: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
    }

    if (!PASSWORD_POLICY.test(password)) {
      return {
        ok: false,
        error: "Password must include uppercase, lowercase, a digit, and a special character.",
      };
    }

    // Update via service role so we can act on behalf of the authenticated user.
    // The middleware already verified the JWT — context.userId is trustworthy.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password,
    });

    if (error) {
      // Log server-side; return a generic message to the client
      console.error("[validateAndUpdatePassword] Supabase error:", error.message);
      return { ok: false, error: "Password update failed. Please try again." };
    }

    return { ok: true };
  });

/**
 * Clears the must_change_password flag for the authenticated admin.
 * Called by the Account page after a successful password update.
 * Requires a valid Bearer token — uses the auth middleware.
 */
export const clearMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ must_change_password: false })
      .eq("user_id", context.userId)
      .eq("role", "admin");

    if (error) {
      console.error("[clearMustChangePassword] Failed:", error.message);
    }

    return { ok: true };
  });
