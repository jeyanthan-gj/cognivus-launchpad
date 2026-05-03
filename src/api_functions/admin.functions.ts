import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
