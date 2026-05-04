import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server-side rate limiting constants — mirror the client-side values
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

/**
 * Hashes an identifier (email) so plaintext is never stored in the DB.
 */
function hashIdentifier(identifier: string): string {
  return createHash("sha256").update(identifier.trim().toLowerCase()).digest("hex");
}

/**
 * Checks whether at least one admin user exists in the system.
 * Returns only a boolean — no emails, no credentials, no PII exposed.
 *
 * Admin provisioning is NOT done automatically here. Use the one-time
 * CLI script (`scripts/provision-admin.ts`) or the Supabase dashboard
 * to create the initial admin account.
 */
export const getAdminReady = createServerFn({ method: "GET" }).handler(async () => {
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("role", "admin")
    .limit(1);

  if (error) {
    // Return false — don't leak internal error details to the client
    return { ready: false };
  }

  return { ready: (roles?.length ?? 0) > 0 };
});

/**
 * Server-side rate-limit check for login attempts.
 * Call this BEFORE calling supabase.auth.signInWithPassword on the client.
 * Stores a hashed identifier (never plaintext) in the login_attempts table.
 *
 * Returns { allowed: true } if the attempt is permitted, or
 * { allowed: false, retryAfterSeconds } if the account is locked.
 */
export const checkLoginRateLimit = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { identifier: string } }) => {
    const hashed = hashIdentifier(data.identifier);
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    // Clean up expired attempts first
    await supabaseAdmin
      .from("login_attempts")
      .delete()
      .lt("attempted_at", windowStart);

    // Count recent attempts
    const { count } = await supabaseAdmin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", hashed)
      .gte("attempted_at", windowStart);

    if ((count ?? 0) >= MAX_ATTEMPTS) {
      // Find the oldest attempt in the window to calculate when lock lifts
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
 * Call this after a failed signInWithPassword.
 */
export const recordFailedLogin = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { identifier: string } }) => {
    const hashed = hashIdentifier(data.identifier);
    await supabaseAdmin.from("login_attempts").insert({ identifier: hashed });
    return { ok: true };
  },
);

/**
 * Clears the must_change_password flag for the currently authenticated admin user.
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
      // Non-fatal — the user successfully changed their password; the flag
      // will be cleared on next provisioning run if this fails.
      console.error("[clearMustChangePassword] Failed:", error.message);
    }

    return { ok: true };
  });
