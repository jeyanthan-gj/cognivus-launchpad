/**
 * Server-only Supabase client — uses the service-role key.
 *
 * SECURITY: This file must NEVER be imported by client-side code.
 * The service-role key bypasses Row Level Security (RLS) entirely.
 * It is read exclusively from process.env (never import.meta.env) so
 * Vite cannot bundle it into the client JavaScript.
 *
 * Import path: @/integrations/supabase/client.server
 * Only import from: server functions (createServerFn), middleware, scripts.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { log } from "@/lib/logger";

function createAdminClient() {
  // Read from process.env — never import.meta.env — so this is server-only.
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    log.suspiciousActivity("missing_env_var", {
      detail: `client.server: missing ${missing.join(", ")}`,
    });
    throw new Error(
      `Missing required server environment variable(s): ${missing.join(", ")}. ` +
      `Ensure these are set in your Netlify environment variable settings and are NOT prefixed with VITE_ for secrets.`,
    );
  }

  return createClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: {
      // Service-role client must never persist a session — it acts as a
      // privileged service account, not as a user.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// Singleton — one admin client per server process lifetime.
let _adminClient: ReturnType<typeof createAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get(_, prop, receiver) {
    if (!_adminClient) _adminClient = createAdminClient();
    return Reflect.get(_adminClient, prop, receiver);
  },
});
